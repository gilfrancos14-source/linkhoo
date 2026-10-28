/**
 * Réservations payées restées sans réponse du gérant.
 *
 * Décision produit : le client paie à la demande, le gérant confirme ensuite.
 * Passé 48 h sans décision, la réservation est annulée et remboursée à 100 %
 * (le client n'a pas à attendre indéfiniment une réponse).
 *
 * L'annulation n'est écrite qu'après acceptation de la demande de
 * remboursement. Si Hub2 refuse définitivement, `payment_cancel_refund` a
 * rendu le montant à la réservation : on ne l'annule pas, sinon le client
 * perdrait sa réservation sans être remboursé. Le job réessaiera.
 */

import { supabaseAdmin } from '../../config/supabase';
import { requestReservationRefund } from '../service/refund';

export const PAID_PENDING_TTL_MS = 48 * 60 * 60 * 1000;

export const PAID_PENDING_BATCH_SIZE = 50;

interface PendingReservationRow {
  id: string;
}

export interface ExpirePaidPendingResult {
  readonly checked: number;
  readonly cancelled: number;
  readonly blocked: number;
}

/**
 * Annule et rembourse les réservations payées sans réponse depuis 48 h.
 *
 * Le délai court depuis `created_at` : avec un checkout limité à 30 minutes,
 * la création et le paiement sont pratiquement simultanés.
 */
export async function expirePaidPendingBookings(
  now: Date = new Date(),
): Promise<ExpirePaidPendingResult> {
  const cutoff = new Date(now.getTime() - PAID_PENDING_TTL_MS).toISOString();
  const nowIso = now.toISOString();

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('statut', 'en_attente')
    .eq('payment_status', 'paid')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(PAID_PENDING_BATCH_SIZE);

  if (error) throw error;

  const rows = (data as PendingReservationRow[] | null) ?? [];
  let cancelled = 0;
  let blocked = 0;

  for (const reservation of rows) {
    try {
      // Le gérant a pu confirmer entre la sélection et ce tour : on ne
      // rembourse pas une réservation qui vient d'être acceptée.
      const { data: current, error: recheckError } = await supabaseAdmin
        .from('reservations')
        .select('id, statut, payment_status')
        .eq('id', reservation.id)
        .maybeSingle();
      if (recheckError) throw recheckError;

      const live = current as
        | { id: string; statut: string; payment_status: string }
        | null;
      if (!live || live.statut !== 'en_attente' || live.payment_status !== 'paid') {
        continue;
      }

      const outcome = await requestReservationRefund({
        reservationId: reservation.id,
        reason: 'auto_expiry',
        requestedBy: 'job:auto_expiry',
      });

      // Refus définitif : le remboursement a été annulé et le montant rendu à
      // la réservation. On garde la réservation en attente pour une reprise
      // manuelle plutôt que de laisser croire au client qu'il est remboursé.
      if (outcome.status === 'failed') {
        blocked += 1;
        console.warn(
          `[payments:expire-paid] remboursement refusé pour ${reservation.id} :`,
          outcome.details ?? outcome.reason ?? 'sans détail',
        );
        continue;
      }

      const { error: cancelError } = await supabaseAdmin
        .from('reservations')
        .update({ statut: 'annulee', responded_at: nowIso })
        .eq('id', reservation.id)
        .eq('statut', 'en_attente');
      if (cancelError) throw cancelError;
      cancelled += 1;
      console.info(`[payments:expire-paid] réservation ${reservation.id} annulée et remboursée`);
    } catch (err) {
      console.error(
        `[payments:expire-paid] ${reservation.id} :`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { checked: rows.length, cancelled, blocked };
}
