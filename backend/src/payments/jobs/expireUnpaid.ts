/**
 * Expiration des checkouts de réservation restés ouverts.
 *
 * Un lien Hub2 vit 30 minutes. Sans ce job, une demande jamais payée
 * bloquerait les dates indéfiniment : deux clients ne peuvent pas payer la
 * même chambre, et la réservation resterait `en_attente`.
 *
 * Avant d'expirer, on REDEMANDE son état à Hub2. Un paiement peut aboutir
 * quelques secondes après l'expiration théorique du lien ; l'annuler à
 * l'aveugle ferait perdre un encaissement réel. Si Hub2 est injoignable, la
 * ligne reste ouverte : le prochain tour retentera.
 *
 * Si un autre lien de la même réservation est encore valide (nouvelle
 * tentative du client), la réservation n'est pas annulée.
 */

import { supabaseAdmin } from '../../config/supabase';
import { getHub2Config, Hub2ConfigError } from '../config';
import { isHub2Provider } from '../provider';
import type { Hub2Currency } from '../types';
import {
  claimSucceededPayment,
  OPEN_PAYMENT_STATUSES,
} from '../service/applyEvent';
import { lookupProviderPayment } from '../service/providerStatus';

/** Marge après l'expiration du lien : laisse arriver un webhook tardif. */
export const EXPIRE_GRACE_MS = 5 * 60 * 1000;

export const EXPIRE_BATCH_SIZE = 50;

interface StalePaymentRow {
  id: string;
  reference: string;
  purpose: string;
  amount: number;
  currency: Hub2Currency;
  provider_payment_link_id: string | null;
  reservation_id: string | null;
}

interface ReservationRow {
  id: string;
  statut: string;
  payment_status: string;
}

export interface ExpireUnpaidResult {
  readonly checked: number;
  readonly expired: number;
  readonly claimed: number;
  readonly cancelledReservations: number;
  readonly skipped: boolean;
}

/**
 * Expire les liens dépassés, puis annule la réservation correspondante
 * lorsqu'aucun autre lien vivant ne peut encore la payer.
 */
export async function expireUnpaidBookings(
  now: Date = new Date(),
): Promise<ExpireUnpaidResult> {
  if (!isHub2Provider()) {
    return { checked: 0, expired: 0, claimed: 0, cancelledReservations: 0, skipped: true };
  }

  let config;
  try {
    config = getHub2Config();
  } catch (error) {
    if (error instanceof Hub2ConfigError) {
      console.warn(`[payments:expire] Hub2 non configuré : ${error.code}`);
      return { checked: 0, expired: 0, claimed: 0, cancelledReservations: 0, skipped: true };
    }
    throw error;
  }

  const nowIso = now.toISOString();
  const expiryCutoff = new Date(now.getTime() - EXPIRE_GRACE_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(
      'id, reference, purpose, amount, currency, provider_payment_link_id, reservation_id',
    )
    .eq('purpose', 'booking')
    .in('status', [...OPEN_PAYMENT_STATUSES])
    .not('reservation_id', 'is', null)
    .lt('expires_at', expiryCutoff)
    .order('expires_at', { ascending: true })
    .limit(EXPIRE_BATCH_SIZE);

  if (error) throw error;

  const rows = (data as StalePaymentRow[] | null) ?? [];
  let expired = 0;
  let claimed = 0;
  let cancelledReservations = 0;

  for (const payment of rows) {
    let providerSucceeded = false;
    try {
      const { payment: providerPayment } = await lookupProviderPayment(
        config,
        payment.reference,
        payment.provider_payment_link_id,
      );
      providerSucceeded = providerPayment !== null;

      if (providerPayment) {
        await claimSucceededPayment({
          reference: payment.reference,
          purpose: payment.purpose,
          providerPaymentId: providerPayment.id,
          amount: providerPayment.amount ?? payment.amount,
          currency: providerPayment.currency ?? payment.currency,
        });
        claimed += 1;
      }
    } catch (err) {
      // Issue incertaine : ne jamais libérer les dates d'un paiement qui a
      // peut-être abouti. Le tour suivant réessaiera.
      console.error(
        `[payments:expire] ${payment.reference} :`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    if (providerSucceeded) continue;

    const { data: expiredRows, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('id', payment.id)
      .in('status', [...OPEN_PAYMENT_STATUSES])
      .select('id');
    if (updateError) throw updateError;

    // Aucune ligne mise à jour : un webhook a fait passer le paiement à
    // `succeeded` entre notre lecture et cette écriture. On ne libère rien.
    if (!Array.isArray(expiredRows) || expiredRows.length === 0) continue;
    expired += 1;

    if (!payment.reservation_id) continue;

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('id, statut, payment_status')
      .eq('id', payment.reservation_id)
      .maybeSingle();
    if (reservationError) throw reservationError;

    const current = reservation as ReservationRow | null;
    if (!current || current.statut !== 'en_attente' || current.payment_status !== 'pending') {
      continue;
    }

    // Une nouvelle tentative a pu ouvrir un lien encore valide : la
    // réservation doit rester bloquée pour ce client-là.
    const { data: livePayment, error: liveError } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reservation_id', payment.reservation_id)
      .in('status', [...OPEN_PAYMENT_STATUSES])
      .gt('expires_at', nowIso)
      .neq('id', payment.id)
      .limit(1)
      .maybeSingle();
    if (liveError) throw liveError;
    if (livePayment) continue;

    const { error: cancelError } = await supabaseAdmin
      .from('reservations')
      .update({
        statut: 'annulee',
        payment_status: 'failed',
        responded_at: nowIso,
      })
      .eq('id', payment.reservation_id)
      .eq('statut', 'en_attente')
      .eq('payment_status', 'pending');
    if (cancelError) throw cancelError;
    cancelledReservations += 1;
    console.info(
      `[payments:expire] réservation ${payment.reservation_id} libérée (${payment.reference})`,
    );
  }

  return {
    checked: rows.length,
    expired,
    claimed,
    cancelledReservations,
    skipped: false,
  };
}
