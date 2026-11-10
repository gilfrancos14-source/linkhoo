/**
 * Réservations payées restées sans réponse du gérant.
 *
 * CORRECTIFS :
 *   - Utilise `requestReservationRefund` (implémentation pawaPay unique).
 *   - Utilise `isRefundDefinitivelySucceeded` (module partagé) au lieu d'une
 *     copie locale.
 *   - Appelle `reconcileReservationRefundState` à chaque étape pour aligner
 *     `reservations` sur l'état réel (règle les états incohérents hérités du
 *     modèle historique où `payment_status='refunded'` est mis dès la
 *     requête).
 */

import { supabaseAdmin } from '../../config/supabase';
import { requestReservationRefund } from '../service/refund';
import {
  isRefundDefinitivelySucceeded,
  reconcileReservationRefundState,
} from '../service/refundReconcile';
import type { RefundOutcome } from '../service/refund';

export const PAID_PENDING_TTL_MS = 48 * 60 * 60 * 1000;
export const PAID_PENDING_BATCH_SIZE = 50;

interface PendingReservationRow {
  id: string;
  payment_status: string;
}

export interface ExpirePaidPendingResult {
  readonly checked: number;
  readonly cancelled: number;
  readonly blocked: number;
  readonly reconciled: number;
}

async function isCancellationSafe(
  reservationId: string,
  outcome: RefundOutcome,
): Promise<boolean> {
  if (outcome.requested && outcome.status === 'succeeded') return true;
  if (!outcome.requested && outcome.reason === 'already_refunded') {
    return isRefundDefinitivelySucceeded(reservationId);
  }
  return false;
}

export async function expirePaidPendingBookings(
  now: Date = new Date(),
): Promise<ExpirePaidPendingResult> {
  const cutoff = new Date(now.getTime() - PAID_PENDING_TTL_MS).toISOString();
  const nowIso = now.toISOString();

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('id, payment_status')
    .eq('statut', 'en_attente')
    .in('payment_status', ['paid', 'refunded'])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(PAID_PENDING_BATCH_SIZE);

  if (error) throw error;

  const rows = (data as PendingReservationRow[] | null) ?? [];
  let cancelled = 0;
  let blocked = 0;
  let reconciled = 0;

  for (const reservation of rows) {
    try {
      const { data: current, error: recheckError } = await supabaseAdmin
        .from('reservations')
        .select('id, statut, payment_status')
        .eq('id', reservation.id)
        .maybeSingle();
      if (recheckError) throw recheckError;

      const live = current as
        | { id: string; statut: string; payment_status: string }
        | null;
      if (
        !live ||
        live.statut !== 'en_attente' ||
        (live.payment_status !== 'paid' && live.payment_status !== 'refunded')
      ) {
        continue;
      }

      // État incohérent (`refunded` mais refunds `failed` ou toujours en vol)
      // → tenter de réconcilier avant de redemander un refund.
      if (live.payment_status === 'refunded') {
        const rec = await reconcileReservationRefundState(reservation.id, now);
        if (rec.changed) {
          reconciled += 1;
          console.info(
            `[payments:expire-paid] ${reservation.id} réconcilié (${rec.reason})`,
          );
          const { data: after } = await supabaseAdmin
            .from('reservations')
            .select('statut, payment_status')
            .eq('id', reservation.id)
            .maybeSingle();
          const fresh = after as { statut: string; payment_status: string } | null;
          if (!fresh || fresh.statut !== 'en_attente') continue;
          if (fresh.payment_status === 'refunded') {
            cancelled += 1;
            continue;
          }
          // payment_status est redevenu `paid` → on retente le refund.
        }
      }

      const outcome = await requestReservationRefund({
        reservationId: reservation.id,
        reason: 'auto_expiry',
        requestedBy: 'job:auto_expiry',
      });

      const safe = await isCancellationSafe(reservation.id, outcome);
      if (!safe) {
        blocked += 1;
        const reason = outcome.requested
          ? `requested:${outcome.status ?? 'unknown'}`
          : `not-requested:${outcome.reason ?? 'unknown'}`;
        console.warn(
          `[payments:expire-paid] ${reservation.id} : non remboursé, annulation différée (${reason})`,
        );
        const rec = await reconcileReservationRefundState(reservation.id, now);
        if (rec.changed) reconciled += 1;
        continue;
      }

      // Aligner `reservations` sur l'état réel (idempotent si déjà fait).
      const rec = await reconcileReservationRefundState(reservation.id, now);
      if (rec.changed) reconciled += 1;

      // Filet : si le reconcile n'a rien changé (déjà annulée), on force.
      const { data: finalRow } = await supabaseAdmin
        .from('reservations')
        .select('statut, payment_status')
        .eq('id', reservation.id)
        .maybeSingle();
      const finalState = finalRow as { statut: string; payment_status: string } | null;
      if (finalState?.statut !== 'annulee' || finalState?.payment_status !== 'refunded') {
        const { error: cancelError } = await supabaseAdmin
          .from('reservations')
          .update({
            statut: 'annulee',
            payment_status: 'refunded',
            responded_at: nowIso,
          })
          .eq('id', reservation.id)
          .eq('statut', 'en_attente');
        if (cancelError) throw cancelError;
      }

      cancelled += 1;
      console.info(`[payments:expire-paid] ${reservation.id} annulée et remboursée`);
    } catch (err) {
      blocked += 1;
      console.error(
        `[payments:expire-paid] ${reservation.id} :`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { checked: rows.length, cancelled, blocked, reconciled };
}