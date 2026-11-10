/**
 * Réconciliation entre `reservations` et `payment_refunds`.
 *
 * PROBLÈME HISTORIQUE :
 *   La RPC `payment_request_refund` met `reservations.payment_status='refunded'`
 *   DÈS LA REQUÊTE, pas à la complétion. Si le refund échoue ou reste en
 *   `processing`, la réservation est dans un état incohérent :
 *      - `payment_status='refunded'` (comme si c'était fait)
 *      - `statut='en_attente'` (comme si le gérant n'avait pas répondu)
 *   Aucun job ne la rattrape, et un refund `failed` ne décrémente pas
 *   `payment_status`.
 *
 * SOLUTION :
 *   `reconcileReservationRefundState(reservationId)` interroge
 *   `payment_refunds` (source de vérité) et aligne `reservations.statut`
 *   en conséquence. Idempotente, safe à appeler depuis n'importe quel
 *   contexte (job, webhook, back-office).
 *
 * APPELÉ PAR :
 *   - `applyPawapayRefundEvent` (webhook pawaPay `refund.COMPLETED`)
 *   - `expirePaidPending.ts` (job avant d'annuler)
 *
 * CONTRAT :
 *   - si tous les refunds sont `succeeded` ET au moins un existe → reservation
 *     `annulee` + `payment_status='refunded'` ;
 *   - si un refund est `failed` et que la somme des succeeded = 0 →
 *     reservation `payment_status='paid'` (le RPC a rendu le montant) ;
 *   - sinon (requested/processing/manual_required) → on ne touche à rien
 *     (le flux est encore en vol, un humain peut devoir intervenir).
 */

import { supabaseAdmin } from '../../config/supabase';

type RefundStatus = 'requested' | 'processing' | 'succeeded' | 'failed' | 'manual_required';

interface ReservationRefundSnapshot {
  id: string;
  statut: string;
  payment_status: string;
  payment_id: string | null;
}

export interface RefundReconcileResult {
  readonly changed: boolean;
  readonly reason: string;
  readonly finalStatus: RefundStatus | 'none';
}

/**
 * Aligne `reservations` sur l'état réel de `payment_refunds`.
 *
 * @param reservationId L'id de la réservation à réconcilier.
 * @param now Horodatage optionnel (tests).
 */
export async function reconcileReservationRefundState(
  reservationId: string,
  now: Date = new Date(),
): Promise<RefundReconcileResult> {
  const { data: reservationRow, error: reservationError } = await supabaseAdmin
    .from('reservations')
    .select('id, statut, payment_status, payment_id')
    .eq('id', reservationId)
    .maybeSingle();
  if (reservationError) throw reservationError;

  const reservation = reservationRow as ReservationRefundSnapshot | null;
  if (!reservation) {
    return { changed: false, reason: 'reservation_not_found', finalStatus: 'none' };
  }

  // Rien à réconcilier : pas de paiement lié, ou statut déjà terminal.
  if (!reservation.payment_id) {
    return { changed: false, reason: 'no_payment_id', finalStatus: 'none' };
  }
  if (reservation.statut === 'annulee' && reservation.payment_status === 'refunded') {
    return { changed: false, reason: 'already_cancelled_refunded', finalStatus: 'succeeded' };
  }

  const { data: refundRows, error: refundError } = await supabaseAdmin
    .from('payment_refunds')
    .select('status')
    .eq('payment_id', reservation.payment_id);
  if (refundError) throw refundError;

  const refunds = (refundRows as { status: RefundStatus }[] | null) ?? [];
  if (refunds.length === 0) {
    return { changed: false, reason: 'no_refunds', finalStatus: 'none' };
  }

  const succeeded = refunds.filter((r) => r.status === 'succeeded').length;
  const failed = refunds.filter((r) => r.status === 'failed').length;
  const active = refunds.filter(
    (r) => r.status === 'requested' || r.status === 'processing' || r.status === 'manual_required',
  ).length;

  // 1) Au moins un refund en vol → ne rien faire, le flux se terminera.
  if (active > 0) {
    return { changed: false, reason: 'refund_in_flight', finalStatus: 'processing' };
  }

  // 2) Tous les refunds sont succeeded → annuler la réservation.
  if (succeeded > 0 && failed === 0) {
    if (reservation.statut === 'annulee' && reservation.payment_status === 'refunded') {
      return { changed: false, reason: 'already_cancelled_refunded', finalStatus: 'succeeded' };
    }
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        statut: 'annulee',
        payment_status: 'refunded',
        responded_at: now.toISOString(),
      })
      .eq('id', reservationId)
      .eq('statut', 'en_attente');
    if (updateError) throw updateError;
    return { changed: true, reason: 'refund_succeeded_cancelled', finalStatus: 'succeeded' };
  }

  // 3) Tous les refunds sont failed → le RPC a rendu le montant à la
  //    réservation. Restaurer `payment_status='paid'` si le RPC ne l'a pas
  //    fait (le RPC `payment_cancel_refund` doit normalement le faire, mais
  //    on rattrape ici par défense).
  if (failed > 0 && succeeded === 0) {
    if (reservation.payment_status === 'paid') {
      return { changed: false, reason: 'already_paid_after_failed_refund', finalStatus: 'failed' };
    }
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        payment_status: 'paid',
      })
      .eq('id', reservationId)
      .eq('statut', 'en_attente');
    if (updateError) throw updateError;
    return { changed: true, reason: 'refund_failed_restored_paid', finalStatus: 'failed' };
  }

  // 4) Mélange réussi/échoué (remboursement partiel) → laisser tel quel.
  return { changed: false, reason: 'mixed_state', finalStatus: 'processing' };
}

/**
 * Vérifie qu'un remboursement est DÉFINITIVEMENT terminé pour cette
 * réservation (tous les refunds liés sont `succeeded`).
 *
 * Remplace l'ancien helper `isRefundDefinitivelySucceeded` (déplacé ici pour
 * être partagé entre le job et les webhooks).
 */
export async function isRefundDefinitivelySucceeded(
  reservationId: string,
): Promise<boolean> {
  const { data: reservationRow, error: reservationError } = await supabaseAdmin
    .from('reservations')
    .select('payment_id')
    .eq('id', reservationId)
    .maybeSingle();
  if (reservationError) throw reservationError;

  const paymentId = (reservationRow as { payment_id?: string | null } | null)?.payment_id;
  if (!paymentId) return false;

  const { data: refundRows, error: refundError } = await supabaseAdmin
    .from('payment_refunds')
    .select('status')
    .eq('payment_id', paymentId);
  if (refundError) throw refundError;

  const refunds = (refundRows as { status: RefundStatus }[] | null) ?? [];
  if (refunds.length === 0) return false;

  const hasActive = refunds.some(
    (r) =>
      r.status === 'requested' ||
      r.status === 'processing' ||
      r.status === 'manual_required',
  );
  const hasSucceeded = refunds.some((r) => r.status === 'succeeded');
  return !hasActive && hasSucceeded;
}