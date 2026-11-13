/**
 * Remboursements pawaPay (phase 3).
 *
 * Règle produit : un remboursement est TOTAL, sauf en cas d'annulation : la
 * plateforme y retient 2 % (frais d'encaissement) et le client reçoit 98 %.
 *
 * Séquence :
 *   1. `payment_request_refund` réserve le montant SOUS VERROU et met à jour
 *      la réservation (le plafond cumulé est vérifié en SQL) ;
 *   2. appel provider (`POST /v2/refunds`) ;
 *   3. si le provider refuse DÉFINITIVEMENT (4xx), `payment_cancel_refund`
 *      rend le montant à la réservation ;
 *   4. si l'issue est incertaine (timeout, 5xx), la ligne reste `processing` :
 *      le webhook ou la réconciliation tranche.
 */

import { supabaseAdmin } from '../../config/supabase';
import { PawapayConfigError, getPawapayConfig } from '../pawapay/config';
import { PaymentServiceError } from '../errors';
import { PawapayApiError, PawapayClient } from '../pawapay/client';
import { createRefundId } from '../pawapay/utils';
import type { PawapayWebhookEvent } from '../pawapay/webhooks';
import type { PawapayCurrency } from '../pawapay/types';
import type { RefundStatus } from '../types';
import { splitCancellationFee } from '../cancellation';
import { reconcileReservationRefundState } from './refundReconcile';

export type RefundReason =
  | 'client_cancellation'
  | 'gerant_refusal'
  | 'gerant_cancellation'
  | 'auto_expiry'
  | 'platform_cancellation'
  | 'dispute'
  | 'goodwill'
  | 'other';

export type RefundMissReason =
  | 'not_paid'
  | 'already_refunded'
  | 'no_provider_payment'
  | 'provider_refused';

export interface RefundOutcome {
  readonly requested: boolean;
  readonly status: RefundStatus | null;
  readonly refundId: string | null;
  readonly reason?: RefundMissReason;
  readonly details?: string;
  /** Frais d'annulation conservés par la plateforme (2 %). */
  readonly platformFee?: number;
  /** Montant effectivement renvoyé au client. */
  readonly clientAmount?: number;
}

interface ReservationRefundRow {
  id: string;
  payment_id: string | null;
  payment_status: string;
}

interface RefundablePayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  provider_payment_id: string | null;
}

const REASON_DETAILS: Record<RefundReason, string> = {
  client_cancellation: 'Annulation par le client',
  gerant_refusal: 'Réservation refusée par le gérant',
  gerant_cancellation: 'Annulation par le gérant',
  auto_expiry: 'Réservation expirée faute de paiement',
  platform_cancellation: 'Annulation par la plateforme',
  dispute: 'Litige',
  goodwill: 'Geste commercial',
  other: 'Remboursement',
};

const ALIVE_REFUND_STATUSES = ['requested', 'processing', 'succeeded', 'manual_required'] as const;

/**
 * Motifs qui déclenchent les frais d'annulation (2 %). Les autres
 * (litige, geste commercial, incident technique) sont des décisions du
 * back-office : le montant remboursé reste celui décidé par l'administrateur.
 */
const CANCELLATION_REFUND_REASONS = new Set<RefundReason>([
  'client_cancellation',
  'gerant_refusal',
  'gerant_cancellation',
  'platform_cancellation',
]);

// NOTE : pas de table de codes motif : l'API pawaPay de remboursement
// N'ACCEPTE PAS le champ `reason` (voir payments/pawapay/types.ts). Le motif
// reste stocké côté base via `p_reason_details`.

async function fetchReservation(reservationId: string): Promise<ReservationRefundRow | null> {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('id, payment_id, payment_status')
    .eq('id', reservationId)
    .maybeSingle();

  if (error) throw error;
  return (data as ReservationRefundRow | null) ?? null;
}

async function fetchRefundablePayment(
  reservation: ReservationRefundRow,
): Promise<RefundablePayment | null> {
  const columns = 'id, status, amount, currency, provider_payment_id';

  if (reservation.payment_id) {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(columns)
      .eq('id', reservation.payment_id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as RefundablePayment;
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(columns)
    .eq('reservation_id', reservation.id)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as RefundablePayment | null) ?? null;
}

async function alreadyRefundedAmount(paymentId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('payment_refunds')
    .select('amount, policy_snapshot')
    .eq('payment_id', paymentId)
    .in('status', [...ALIVE_REFUND_STATUSES]);

  if (error) throw error;
  // Les frais d'annulation (2 %) sont conservés par la plateforme : ils
  // comptent comme déjà remboursés, sinon un second appel les reverserait.
  return (
    (data as { amount: number | string; policy_snapshot?: { platform_fee?: number } | null }[] | null) ??
    []
  ).reduce((sum, row) => {
    const fee = Number(row.policy_snapshot?.platform_fee ?? 0);
    return sum + Number(row.amount) + (Number.isFinite(fee) ? fee : 0);
  }, 0);
}

async function updateRefund(
  refundId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('payment_refunds')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', refundId);
  if (error) throw error;
}

function rpcMiss(error: { message?: string }): RefundMissReason | null {
  const message = error.message ?? '';
  if (message.includes('REFUND_EXCEEDS_PAYMENT')) return 'already_refunded';
  if (message.includes('PAYMENT_NOT_REFUNDABLE')) return 'not_paid';
  return null;
}

/**
 * À appeler après un refund `succeeded` pour aligner `reservations`
 * (statut + payment_status) sur l'état réel des refunds. Idempotent.
 *
 * On fait DEUX requêtes explicites plutôt qu'un joint Supabase
 * `payments:payment_id(...)` : le joint ne fonctionne que si la FK est
 * exposée par PostgREST, et il casse silencieusement sinon.
 */
async function reconcileReservationFromRefundId(refundId: string): Promise<void> {
  const { data: refundRow, error: refundError } = await supabaseAdmin
    .from('payment_refunds')
    .select('payment_id')
    .eq('id', refundId)
    .maybeSingle();
  if (refundError) {
    console.warn('[refund] reconcile lookup refund échoué', {
      refundId,
      error: refundError.message,
    });
    return;
  }

  const paymentId = (refundRow as { payment_id?: string | null } | null)?.payment_id;
  if (!paymentId) return;

  const { data: paymentRow, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('reservation_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (paymentError) {
    console.warn('[refund] reconcile lookup payment échoué', {
      refundId,
      paymentId,
      error: paymentError.message,
    });
    return;
  }

  const reservationId = (paymentRow as { reservation_id?: string | null } | null)?.reservation_id;
  if (!reservationId) return;

  try {
    await reconcileReservationRefundState(reservationId);
  } catch (err) {
    console.warn('[refund] reconcile réservation échoué', {
      refundId,
      reservationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function requestReservationRefund(input: {
  reservationId: string;
  reason: RefundReason;
  requestedBy: string;
  reasonDetails?: string | null;
}): Promise<RefundOutcome> {
  const reservation = await fetchReservation(input.reservationId);
  if (!reservation) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Réservation introuvable.', 404);
  }
  if (reservation.payment_status === 'refunded') {
    return { requested: false, status: 'succeeded', refundId: null, reason: 'already_refunded' };
  }

  const payment = await fetchRefundablePayment(reservation);
  if (!payment || payment.status !== 'succeeded') {
    return { requested: false, status: null, refundId: null, reason: 'not_paid' };
  }

  const remaining = payment.amount - (await alreadyRefundedAmount(payment.id));
  if (remaining <= 0) {
    return { requested: false, status: 'succeeded', refundId: null, reason: 'already_refunded' };
  }

  // Motif normalisé : texte libre fourni, sinon le libellé par défaut de la
  // raison (pawaPay ne peut pas recevoir le motif — champ `reason` rejeté par
  // son API — donc on le garde exploitable en base).
  const details = input.reasonDetails?.trim() || REASON_DETAILS[input.reason];

  // Frais d'annulation : en cas d'annulation, la plateforme conserve 2 % du
  // montant (frais d'encaissement) et le client reçoit le reste. Sur une
  // annulation, la commission habituelle (5/10/15 %) n'est pas prélevée :
  // elle ne s'applique qu'aux séjours réellement effectués.
  const cancellation = CANCELLATION_REFUND_REASONS.has(input.reason);
  const { fee, clientAmount } = cancellation
    ? splitCancellationFee(remaining)
    : { fee: 0, clientAmount: remaining };

  if (clientAmount <= 0) {
    return { requested: false, status: null, refundId: null, reason: 'already_refunded' };
  }

  const { data, error } = await supabaseAdmin.rpc('payment_request_refund', {
    p_payment_id: payment.id,
    p_amount: clientAmount,
    p_reason: input.reason,
    p_requested_by: input.requestedBy,
    p_reason_details: details.slice(0, 500),
    p_policy_snapshot: {
      source: 'payment_policies',
      commission_percent: 0,
      deposit_percent: 100,
    },
    p_platform_fee: fee,
  });

  if (error) {
    const miss = rpcMiss(error);
    if (miss) return { requested: false, status: null, refundId: null, reason: miss };
    throw new PaymentServiceError(
      'PAYMENT_REFUND_FAILED',
      `Remboursement impossible : ${error.message ?? 'erreur inconnue'}`,
      500,
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { refund_id?: string }
    | undefined;
  const refundId = row?.refund_id ?? null;
  if (!refundId) {
    throw new PaymentServiceError(
      'PAYMENT_REFUND_FAILED',
      'Remboursement enregistré sans identifiant.',
      500,
    );
  }

  if (!payment.provider_payment_id) {
    await updateRefund(refundId, {
      status: 'manual_required',
      provider_status: 'missing_payment_id',
    });
    return {
      requested: true,
      status: 'manual_required',
      refundId,
      reason: 'no_provider_payment',
    };
  }

  try {
    const client = new PawapayClient(getPawapayConfig());
    const refundUuid = createRefundId();

    // Persisté AVANT l'appel : un callback peut arriver avant la réponse HTTP.
    // Sans cela, `applyRefundCallback` ne trouvait aucune ligne et l'événement
    // était perdu silencieusement.
    const { error: persistError } = await supabaseAdmin
      .from('payment_refunds')
      .update({
        provider_refund_id: refundUuid,
        status: 'processing',
        provider_status: 'INITIATED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundId);
    if (persistError) {
      throw new PaymentServiceError(
        'PAYMENT_REFUND_FAILED',
        `Impossible de réserver le remboursement pawaPay : ${persistError.message}`,
        500,
        { refundId },
      );
    }

    const response = await client.createRefund({
      refundId: refundUuid,
      depositId: payment.provider_payment_id,
      // Le client reçoit le montant net de frais d'annulation.
      amount: clientAmount.toFixed(0),
      // pawaPay exige `currency` dès qu'un `amount` est fourni.
      currency: payment.currency as PawapayCurrency,
    });

    await updateRefund(refundId, {
      status: 'processing',
      provider_refund_id: refundUuid,
      provider_status: response.status ?? 'ACCEPTED',
    });

    return {
      requested: true,
      status: 'processing',
      refundId,
      platformFee: fee,
      clientAmount,
    };
  } catch (error) {
    const definitive =
      error instanceof PawapayConfigError ||
      (error instanceof PawapayApiError &&
        error.statusCode !== null &&
        error.statusCode >= 400 &&
        error.statusCode < 500);

    if (!definitive) {
      await updateRefund(refundId, {
        status: 'processing',
        provider_status: 'unconfirmed',
      });
      return {
        requested: true,
        status: 'processing',
        refundId,
        details: error instanceof Error ? error.message : String(error),
      };
    }

    const { error: cancelError } = await supabaseAdmin.rpc('payment_cancel_refund', {
      p_refund_id: refundId,
    });
    if (cancelError) {
      console.error('[refund] compensation impossible:', cancelError.message);
    }

    return {
      requested: true,
      status: 'failed',
      refundId,
      reason: 'provider_refused',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function findRefundByProviderId(
  providerRefundId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_refunds')
    .select('id, status')
    .eq('provider_refund_id', providerRefundId)
    .maybeSingle();

  if (error) throw error;
  return (data as { id: string; status: string } | null) ?? null;
}

/**
 * Statuts provider d'un remboursement pawaPay.
 *
 * `ACCEPTED` couvre aussi les valeurs inconnues : un statut non reconnu ne doit
 * jamais clore un remboursement (on le laisse en vol).
 */
export type RefundProviderStatus = 'COMPLETED' | 'REJECTED' | 'FAILED' | 'ACCEPTED';

/**
 * Applique un statut provider à une ligne `payment_refunds` et aligne la
 * réservation. Partagé par le webhook pawaPay et par la relance manuelle admin.
 */
export async function applyRefundProviderStatus(
  paymentRefundId: string,
  providerStatus: RefundProviderStatus,
): Promise<void> {
  switch (providerStatus) {
    case 'COMPLETED': {
      await updateRefund(paymentRefundId, {
        status: 'succeeded',
        provider_status: providerStatus,
        completed_at: new Date().toISOString(),
      });
      await reconcileReservationFromRefundId(paymentRefundId);
      return;
    }

    case 'REJECTED': {
      const { error } = await supabaseAdmin.rpc('payment_cancel_refund', {
        p_refund_id: paymentRefundId,
      });
      if (error) throw error;
      await updateRefund(paymentRefundId, {
        status: 'failed',
        provider_status: providerStatus,
      });
      await reconcileReservationFromRefundId(paymentRefundId);
      return;
    }

    case 'FAILED': {
      await updateRefund(paymentRefundId, {
        status: 'failed',
        provider_status: providerStatus,
      });
      await reconcileReservationFromRefundId(paymentRefundId);
      return;
    }

    case 'ACCEPTED':
    default: {
      await updateRefund(paymentRefundId, {
        status: 'processing',
        provider_status: providerStatus,
      });
    }
  }
}

/**
 * Applique un webhook de remboursement pawaPay.
 */
export async function applyPawapayRefundEvent(
  event: PawapayWebhookEvent,
): Promise<{ handled: boolean; reason?: string }> {
  if (event.kind !== 'refund') {
    return { handled: false, reason: 'not_a_refund_event' };
  }

  const refundId = event.data.refundId;
  if (!refundId) return { handled: false, reason: 'missing_refund_id' };

  const refund = await findRefundByProviderId(refundId);
  if (!refund) return { handled: false, reason: 'refund_not_found' };

  if (refund.status === 'succeeded') return { handled: true };

  await applyRefundProviderStatus(
    refund.id,
    (event.data.status ?? 'ACCEPTED') as RefundProviderStatus,
  );
  return { handled: true };
}
