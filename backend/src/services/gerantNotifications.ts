/**
 * Notifications destinées au GÉRANT (table `notifications`, cloche de
 * l'espace gérant, pollée toutes les 30 s).
 *
 * Miroir de `clientNotifications.ts` : écritures « fire and forget » — une
 * panne de notification ne doit jamais faire échouer l'envoi d'un message ou
 * la relance d'un reversement.
 */

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../lib/logger';
import { publishNotificationChanged } from '../utils/realtime';

export type GerantNotificationType =
  | 'message_received'
  | 'payout_retry_started';

export interface NotifyGerantInput {
  readonly gerantId: string | null | undefined;
  readonly type: GerantNotificationType;
  readonly message: string;
  readonly roomId?: string | null;
  readonly clientName?: string | null;
  readonly clientEmail?: string | null;
  readonly reservationId?: string | null;
}

/** Crée une notification gérant. Retourne false si ignorée (erreur/doublon). */
export async function notifyGerant(input: NotifyGerantInput): Promise<boolean> {
  if (!input.gerantId) return false;

  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: input.type,
      room_title: null,
      room_id: input.roomId ?? null,
      client_name: input.clientName ?? null,
      client_email: input.clientEmail ?? null,
      client_phone: null,
      message: input.message,
      reservation_id: input.reservationId ?? null,
      gerant_id: input.gerantId,
    });
    if (error) {
      logger.warn('[notifications] Impossible de créer la notification gérant', { error });
      return false;
    }

    publishNotificationChanged('gerant');
    return true;
  } catch (error) {
    logger.warn('[notifications] Échec notification gérant (non bloquant)', { error });
    return false;
  }
}

/** Nouveau message d'un client dans une conversation : notification sans e-mail. */
export function notifyGerantNewMessage(input: {
  readonly gerantId: string | null | undefined;
  readonly clientName: string | null | undefined;
  readonly clientEmail: string | null | undefined;
  readonly roomId: string | null | undefined;
  readonly body: string;
}): Promise<boolean> {
  const excerpt = input.body.replace(/\s+/g, ' ').trim().slice(0, 160);
  const suffix = input.body.length > 160 ? '…' : '';
  const who = input.clientName?.trim() || 'Un client';

  return notifyGerant({
    gerantId: input.gerantId,
    type: 'message_received',
    roomId: input.roomId,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    message: `Nouveau message de ${who} : « ${excerpt}${suffix} »`,
  });
}

/** L'admin a remis un reversement en file d'attente. */
export function notifyGerantPayoutRetry(input: {
  readonly gerantId: string | null | undefined;
  readonly reference: string;
  readonly amount: number;
  readonly currency: string;
}): Promise<boolean> {
  const amount = new Intl.NumberFormat('fr-FR').format(input.amount);
  return notifyGerant({
    gerantId: input.gerantId,
    type: 'payout_retry_started',
    message: `Votre reversement ${input.reference} (${amount} ${input.currency}) a été remis en file d'attente.`,
  });
}
