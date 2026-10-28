/**
 * Remboursements Hub2 (phase 3).
 *
 * Règle produit : tout remboursement est TOTAL (100 % de la somme encaissée).
 * Le montant reste paramétrable côté RPC pour les gestes commerciaux et les
 * litiges, mais aucun appelant automatique ne demande autre chose que le solde
 * restant.
 *
 * Séquence :
 *   1. `payment_request_refund` réserve le montant SOUS VERROU et met à jour la
 *      réservation (le plafond cumulé est vérifié en SQL) ;
 *   2. `POST /payments-refund/{paymentId}/refund` demande l'exécution Hub2 ;
 *   3. si Hub2 refuse DÉFINITIVEMENT (4xx), `payment_cancel_refund` rend le
 *      montant à la réservation — sinon elle resterait « remboursée » sans
 *      l'être ;
 *   4. si l'issue est incertaine (timeout, 5xx), la ligne reste `processing` :
 *      le webhook ou la réconciliation tranche, jamais une compensation
 *      aveugle (l'argent peut être parti).
 */

import { supabaseAdmin } from '../../config/supabase';
import { Hub2ConfigError, getHub2Config } from '../config';
import { PaymentServiceError } from '../errors';
import { Hub2Error, hub2Request } from '../hub2/client';
import type { Hub2Event } from '../hub2/webhooks';
import type { EventKind } from '../hub2/mapping';
import type { RefundStatus } from '../types';

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

/**
 * Codes envoyés à Hub2. La documentation ne publie pas d'énumération : on
 * reste sur des valeurs génériques et on met le motif interne dans
 * `reasonDetails`, lisible dans le dashboard.
 */
const HUB2_REASON_CODES: Record<RefundReason, string> = {
  client_cancellation: 'customer_request',
  gerant_refusal: 'service_not_provided',
  gerant_cancellation: 'service_not_provided',
  auto_expiry: 'other',
  platform_cancellation: 'service_not_provided',
  dispute: 'other',
  goodwill: 'customer_request',
  other: 'other',
};

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
    .select('amount')
    .eq('payment_id', paymentId)
    .in('status', [...ALIVE_REFUND_STATUSES]);

  if (error) throw error;
  return (data as { amount: number | string }[] | null)?.reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  ) ?? 0;
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
 * Demande le remboursement total du solde restant d'une réservation.
 *
 * Ne lève pas quand il n'y a rien à rembourser : l'annulation d'une
 * réservation non payée est un cas normal, pas une erreur.
 */
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

  const { data, error } = await supabaseAdmin.rpc('payment_request_refund', {
    p_payment_id: payment.id,
    p_amount: remaining,
    p_reason: input.reason,
    p_requested_by: input.requestedBy,
    p_reason_details: input.reasonDetails ?? null,
    p_policy_snapshot: {
      source: 'payment_policies',
      commission_percent: 0,
      deposit_percent: 100,
    },
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

  // Sans identifiant de paiement Hub2, l'API de remboursement est
  // inutilisable : on laisse la ligne à traiter manuellement plutôt que de
  // faire croire au client que l'argent est reparti.
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

  const details = input.reasonDetails?.trim() || REASON_DETAILS[input.reason];

  try {
    const response = await hub2Request<{ id?: unknown }>(
      getHub2Config(),
      `/payments-refund/${encodeURIComponent(payment.provider_payment_id)}/refund`,
      {
        method: 'POST',
        body: {
          amount: remaining,
          reasonCode: HUB2_REASON_CODES[input.reason],
          reasonDetails: details.slice(0, 500),
        },
      },
    );

    const providerRefundId =
      response?.id === undefined || response?.id === null ? null : String(response.id);

    await updateRefund(refundId, {
      status: 'processing',
      provider_refund_id: providerRefundId,
      provider_status: 'created',
    });

    return { requested: true, status: 'processing', refundId };
  } catch (error) {
    const definitive =
      error instanceof Hub2ConfigError ||
      (error instanceof Hub2Error &&
        error.status !== null &&
        error.status >= 400 &&
        error.status < 500);

    if (!definitive) {
      // Issue incertaine : le remboursement est peut-être parti. La ligne
      // reste `processing`, le webhook ou la réconciliation la clôturera.
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
 * Applique un webhook de remboursement.
 *
 * `refund_failed` sur une ligne déjà `succeeded` est ignoré : un événement
 * tardif ne doit pas « dé-rembourser » un client réellement remboursé.
 */
export async function applyRefundEvent(
  event: Hub2Event,
  kind: EventKind,
  refundId: string | null,
): Promise<{ handled: boolean; reason?: string }> {
  if (!refundId) return { handled: false, reason: 'missing_reference' };

  const refund = await findRefundByProviderId(refundId);
  if (!refund) return { handled: false, reason: 'refund_not_found' };

  const providerStatus =
    typeof event.data.status === 'string' ? event.data.status : null;

  if (refund.status === 'succeeded') return { handled: true };

  switch (kind) {
    case 'refund_succeeded':
      await updateRefund(refund.id, {
        status: 'succeeded',
        provider_status: providerStatus ?? 'successful',
        completed_at: new Date().toISOString(),
      });
      return { handled: true };

    case 'refund_manual':
      await updateRefund(refund.id, {
        status: 'manual_required',
        provider_status: providerStatus ?? 'pending_manual',
      });
      return { handled: true };

    case 'refund_failed': {
      // Compensation : rend le montant à la réservation et recalcule son
      // statut de paiement sous verrou.
      const { error } = await supabaseAdmin.rpc('payment_cancel_refund', {
        p_refund_id: refund.id,
      });
      if (error) throw error;
      await updateRefund(refund.id, {
        provider_status: providerStatus ?? 'failed',
      });
      return { handled: true };
    }

    case 'refund_processing':
    default:
      await updateRefund(refund.id, {
        status: 'processing',
        provider_status: providerStatus ?? 'pending',
      });
      return { handled: true };
  }
}
