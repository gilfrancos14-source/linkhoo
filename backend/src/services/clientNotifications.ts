/**
 * Notifications destinées au CLIENT.
 *
 * Deux canaux alimentés ici :
 *   1. la table `client_notifications` (cloche + bannière de l'espace client,
 *      pollées toutes les 30 s par le frontend) ;
 *   2. un e-mail transactionnel Resend, non bloquant, envoyé seulement pour
 *      les décisions et les paiements (jamais pour les messages, pour éviter
 *      de transformer la messagerie en spam).
 *
 * Toutes les fonctions sont « fire and forget » : une panne de notification ne
 * doit jamais faire échouer la réservation, le paiement ou l'envoi d'un message.
 * Les identifiants des notifications de paiement sont déterministes, ce qui
 * rend les webhooks rejoués inoffensifs (upsert avec ignore-duplicates).
 */

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../lib/logger';
import { publishNotificationChanged } from '../utils/realtime';
import { sendClientNotificationEmail } from './mailer';

export type ClientNotificationType =
  | 'reservation_confirmed'
  | 'reservation_rejected'
  | 'reservation_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_refunded'
  | 'new_message';

const EMAIL_SUBJECTS: Partial<Record<ClientNotificationType, string>> = {
  reservation_confirmed: 'Votre réservation est confirmée',
  reservation_rejected: 'Votre réservation a été refusée',
  reservation_cancelled: 'Votre réservation a été annulée',
  payment_succeeded: 'Votre paiement est confirmé',
  payment_failed: 'Votre paiement n’a pas abouti',
  payment_refunded: 'Votre remboursement est effectué',
};

export interface NotifyClientInput {
  /** Identifiant déterministe pour rendre l'écriture idempotente (webhooks). */
  readonly id?: string;
  readonly clientEmail: string | null | undefined;
  readonly type: ClientNotificationType;
  readonly message: string;
  readonly roomId?: string | null;
  readonly roomTitle?: string | null;
  readonly actionPath?: string;
}

/** Crée une notification client. Retourne false si ignorée (doublon/erreur). */
export async function notifyClient(input: NotifyClientInput): Promise<boolean> {
  if (!input.clientEmail) return false;

  try {
    const id = input.id ?? randomUUID();
    const { data, error } = await supabaseAdmin
      .from('client_notifications')
      .upsert(
        {
          id,
          type: input.type,
          client_email: input.clientEmail,
          room_id: input.roomId ?? null,
          room_title: input.roomTitle ?? null,
          message: input.message,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();

    if (error) {
      logger.warn('[i18n] Impossible de créer la notification client', { error });
      return false;
    }
    if (!data) return false; // doublon : notification déjà présente

    publishNotificationChanged('client');

    const subject = EMAIL_SUBJECTS[input.type];
    if (subject) {
      void sendClientNotificationEmail({
        to: input.clientEmail,
        subject,
        title: subject,
        message: input.message,
        actionPath: input.actionPath,
      });
    }
    return true;
  } catch (error) {
    logger.warn('[notifications] Échec notification client (non bloquant)', { error });
    return false;
  }
}

/** Décision du gérant sur une réservation (confirmation ou refus). */
export function notifyClientReservationDecision(input: {
  readonly clientEmail: string | null | undefined;
  readonly confirmed: boolean;
  readonly roomId?: string | null;
  readonly roomTitle?: string | null;
  readonly reason?: string | null;
}): Promise<boolean> {
  const room = input.roomTitle ?? 'votre logement';
  const message = input.confirmed
    ? `Votre réservation pour "${room}" a été confirmée par l'hôte.`
    : `Votre demande pour "${room}" a été refusée par l'hôte.${input.reason ? ` ${input.reason}` : ''}`;

  return notifyClient({
    clientEmail: input.clientEmail,
    type: input.confirmed ? 'reservation_confirmed' : 'reservation_rejected',
    roomId: input.roomId,
    roomTitle: input.roomTitle,
    message,
  });
}

/**
 * Notification de paiement à partir d'un webhook pawaPay (checkout ou dépôt).
 * Le statut est relu en base après application de l'événement : c'est la
 * transition métier qui fait foi, pas le libellé brut du provider.
 */
export async function notifyClientWebhookPayment(body: unknown): Promise<void> {
  try {
    const event = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    if (typeof event.refundId === 'string') {
      await notifyClientRefund(event.refundId);
      return;
    }

    const checkoutId = typeof event.checkoutId === 'string' ? event.checkoutId : null;
    const depositId = typeof event.depositId === 'string' ? event.depositId : null;
    if (!checkoutId && !depositId) return;

    const payment = checkoutId
      ? await findPayment('pawapay_checkout_id', checkoutId)
      : await findPayment('pawapay_deposit_id', depositId as string);
    if (payment) await notifyClientFromPayment(payment.reference);
  } catch (error) {
    logger.warn('[notifications] Webhook paiement : notification ignorée', { error });
  }
}

interface PaymentRow {
  readonly reference: string;
  readonly status: string;
  readonly purpose: string;
  readonly reservation_id: string | null;
  readonly market?: string | null;
}

async function findPayment(
  column: 'pawapay_checkout_id' | 'pawapay_deposit_id',
  value: string,
): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('reference, status, purpose, reservation_id, market')
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentRow | null) ?? null;
}

async function notifyClientFromPayment(reference: string): Promise<void> {
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('reference, status, purpose, reservation_id, market')
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw error;
  if (!payment || payment.purpose !== 'booking' || !payment.reservation_id) return;

  const status = (payment as PaymentRow).status;
  const type: ClientNotificationType | null =
    status === 'succeeded'
      ? 'payment_succeeded'
      : ['failed', 'canceled', 'expired'].includes(status)
        ? 'payment_failed'
        : null;
  if (!type) return;

  const { data: reservation } = await supabaseAdmin
    .from('reservations')
    .select('client_email, room_id, room_title')
    .eq('id', payment.reservation_id)
    .maybeSingle();
  const clientEmail = reservation?.client_email as string | undefined;
  if (!clientEmail) return;

  const messages: Record<string, string> = {
    payment_succeeded: `Votre paiement pour "${reservation?.room_title ?? 'votre réservation'}" a bien été confirmé.`,
    payment_failed: `Votre paiement pour "${reservation?.room_title ?? 'votre réservation'}" n'a pas abouti. Vous pouvez réessayer depuis votre espace client.`,
  };
  const market = String(payment.market ?? 'CI').toLowerCase();

  await notifyClient({
    id: `payment-${payment.reference}-${status}`,
    clientEmail,
    type,
    message: messages[type as 'payment_succeeded' | 'payment_failed'],
    roomId: reservation?.room_id as string | undefined,
    roomTitle: reservation?.room_title as string | undefined,
    actionPath: `/${market}/suivi-reservation`,
  });
}

/** Remboursement pawaPay réussi, identifié par son ID provider. */
async function notifyClientRefund(providerRefundId: string): Promise<void> {
  const { data: refund, error } = await supabaseAdmin
    .from('payment_refunds')
    .select('id, reservation_id, status, amount, currency')
    .eq('provider_refund_id', providerRefundId)
    .maybeSingle();
  if (error) throw error;
  if (!refund || refund.status !== 'succeeded' || !refund.reservation_id) return;

  const { data: reservation } = await supabaseAdmin
    .from('reservations')
    .select('client_email, room_id, room_title')
    .eq('id', refund.reservation_id)
    .maybeSingle();
  if (!reservation?.client_email) return;

  await notifyClient({
    id: `refund-${refund.id}`,
    clientEmail: reservation.client_email as string,
    type: 'payment_refunded',
    message: `Votre remboursement pour "${reservation.room_title ?? 'votre réservation'}" a été effectué.`,
    roomId: reservation.room_id as string | undefined,
    roomTitle: reservation.room_title as string | undefined,
  });
}

/** Nouveau message d'un hôte dans une conversation : notification sans e-mail. */
export function notifyClientNewMessage(input: {
  readonly clientEmail: string | null | undefined;
  readonly roomId?: string | null;
  readonly body: string;
}): Promise<boolean> {
  const excerpt = input.body.replace(/\s+/g, ' ').trim().slice(0, 160);
  return notifyClient({
    clientEmail: input.clientEmail,
    type: 'new_message',
    roomId: input.roomId,
    message: `Nouveau message de votre hôte : « ${excerpt}${input.body.length > 160 ? '…' : ''} »`,
  });
}
