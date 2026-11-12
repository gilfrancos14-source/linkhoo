/**
 * Back-office des remboursements.
 *
 * Objectif : rendre visibles les remboursements qui demandent une intervention
 * humaine (`failed`, `manual_required`, `processing` bloqué) et permettre de
 * les relancer sans risque de double débit.
 *
 * Règle de sécurité : ce service ne calcule JAMAIS de montant. Toute mutation
 * d'argent passe par `requestReservationRefund` (RPC `payment_request_refund`
 * verrouillée et plafonnée) et `payment_cancel_refund`. Un double clic ou deux
 * admins simultanés se heurtent donc au verrou SQL, pas à une estimation JS.
 */

import { supabaseAdmin } from '../../config/supabase';
import { PaymentServiceError } from '../errors';
import { getRefund } from '../pawapay/refunds';
import {
  applyRefundProviderStatus,
  requestReservationRefund,
  type RefundOutcome,
  type RefundProviderStatus,
  type RefundReason,
} from './refund';

export type AdminRefundStatus =
  | 'requested'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'manual_required'
  | 'canceled';

/** Groupe affiché dans le back-office. */
export type AdminRefundScope = 'attention' | 'processing' | 'all';

export interface AdminRefundReservation {
  clientName: string | null;
  clientEmail: string | null;
  roomTitle: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  statut: string | null;
  paymentStatus: string | null;
}

export interface AdminRefund {
  id: string;
  paymentId: string;
  reservationId: string | null;
  status: AdminRefundStatus;
  amount: number;
  currency: string;
  reason: string;
  reasonDetails: string | null;
  providerStatus: string | null;
  /** Un identifiant provider existe : la relance peut aboutir. */
  hasProviderRefund: boolean;
  /** Le paiement source a un `provider_payment_id` : pawaPay peut rembourser. */
  hasProviderPayment: boolean;
  requestedAt: string;
  updatedAt: string;
  reservation: AdminRefundReservation | null;
}

export interface AdminRefundCounts {
  failed: number;
  manual_required: number;
  processing: number;
  total: number;
}

export interface ListAdminRefundsResult {
  items: AdminRefund[];
  counts: AdminRefundCounts;
}

export interface ListAdminRefundsInput {
  scope?: AdminRefundScope;
  limit?: number;
}

export interface SyncAdminRefundResult {
  status: AdminRefundStatus;
  synced: boolean;
  reason?: string;
}

const REFUND_COLUMNS =
  'id, payment_id, reservation_id, amount, currency, reason, reason_details, status, provider_refund_id, provider_status, requested_at, updated_at';

/** Statuts affichés par le panneau (y compris le suivi des remboursements en vol). */
const PANEL_STATUSES = ['failed', 'manual_required', 'processing'] as const;

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

interface RefundRow {
  id: string;
  payment_id: string;
  reservation_id: string | null;
  amount: number | string;
  currency: string;
  reason: string;
  reason_details: string | null;
  status: AdminRefundStatus;
  provider_refund_id: string | null;
  provider_status: string | null;
  requested_at: string;
  updated_at: string;
}

interface PaymentRow {
  id: string;
  reservation_id: string | null;
  provider_payment_id: string | null;
  status: string;
}

interface ReservationRow {
  id: string;
  client_name: string | null;
  client_email: string | null;
  room_title: string | null;
  date_debut: string | null;
  date_fin: string | null;
  statut: string | null;
  payment_status: string | null;
}

async function fetchRefundRow(paymentRefundId: string): Promise<RefundRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_refunds')
    .select(REFUND_COLUMNS)
    .eq('id', paymentRefundId)
    .maybeSingle();
  if (error) throw error;
  return (data as RefundRow | null) ?? null;
}

async function fetchPaymentRow(paymentId: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, reservation_id, provider_payment_id, status')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentRow | null) ?? null;
}

function mapScopeFilter(scope: AdminRefundScope): (status: AdminRefundStatus) => boolean {
  if (scope === 'processing') return (status) => status === 'processing';
  if (scope === 'all') return () => true;
  return (status) => status === 'failed' || status === 'manual_required';
}

/**
 * Liste les remboursements à surveiller.
 *
 * `scope` filtre l'affichage, mais les compteurs portent toujours sur les trois
 * statuts « à surveiller » : le badge du panneau reste juste quel que soit
 * l'onglet ouvert.
 */
export async function listAdminRefunds(
  input: ListAdminRefundsInput = {},
): Promise<ListAdminRefundsResult> {
  const scope = input.scope ?? 'attention';
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const { data: countRows, error: countError } = await supabaseAdmin
    .from('payment_refunds')
    .select('status')
    .in('status', [...PANEL_STATUSES]);
  if (countError) throw countError;

  const counts: AdminRefundCounts = {
    failed: 0,
    manual_required: 0,
    processing: 0,
    total: 0,
  };
  for (const row of (countRows as { status: AdminRefundStatus }[] | null) ?? []) {
    if (row.status === 'failed') counts.failed += 1;
    else if (row.status === 'manual_required') counts.manual_required += 1;
    else if (row.status === 'processing') counts.processing += 1;
  }
  counts.total = counts.failed + counts.manual_required + counts.processing;

  const { data: refundRows, error: refundError } = await supabaseAdmin
    .from('payment_refunds')
    .select(REFUND_COLUMNS)
    .in('status', [...PANEL_STATUSES])
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (refundError) throw refundError;

  const refunds = ((refundRows as RefundRow[] | null) ?? []).filter((row) =>
    mapScopeFilter(scope)(row.status),
  );

  const paymentIds = [...new Set(refunds.map((row) => row.payment_id))];
  const paymentsById = new Map<string, PaymentRow>();
  if (paymentIds.length > 0) {
    const { data: paymentRows, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, reservation_id, provider_payment_id, status')
      .in('id', paymentIds);
    if (paymentError) throw paymentError;
    for (const payment of (paymentRows as PaymentRow[] | null) ?? []) {
      paymentsById.set(payment.id, payment);
    }
  }

  const reservationIds = [
    ...new Set(
      refunds
        .map((row) => row.reservation_id ?? paymentsById.get(row.payment_id)?.reservation_id ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const reservationsById = new Map<string, ReservationRow>();
  if (reservationIds.length > 0) {
    const { data: reservationRows, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select(
        'id, client_name, client_email, room_title, date_debut, date_fin, statut, payment_status',
      )
      .in('id', reservationIds);
    if (reservationError) throw reservationError;
    for (const reservation of (reservationRows as ReservationRow[] | null) ?? []) {
      reservationsById.set(reservation.id, reservation);
    }
  }

  const items: AdminRefund[] = refunds.map((row) => {
    const payment = paymentsById.get(row.payment_id);
    const reservationId = row.reservation_id ?? payment?.reservation_id ?? null;
    const reservation = reservationId ? reservationsById.get(reservationId) : undefined;
    return {
      id: row.id,
      paymentId: row.payment_id,
      reservationId,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
      reason: row.reason,
      reasonDetails: row.reason_details,
      providerStatus: row.provider_status,
      hasProviderRefund: Boolean(row.provider_refund_id),
      hasProviderPayment: Boolean(payment?.provider_payment_id),
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
      reservation: reservation
        ? {
            clientName: reservation.client_name,
            clientEmail: reservation.client_email,
            roomTitle: reservation.room_title,
            dateDebut: reservation.date_debut,
            dateFin: reservation.date_fin,
            statut: reservation.statut,
            paymentStatus: reservation.payment_status,
          }
        : null,
    };
  });

  return { items, counts };
}

/**
 * Relance un remboursement échoué.
 *
 * - `failed` : le montant a déjà été rendu à la réservation par
 *   `payment_cancel_refund`, une nouvelle demande est possible.
 * - `manual_required` : l'ancienne ligne réserve encore le montant, il faut la
 *   libérer d'abord, sinon la RPC refuse pour dépassement.
 */
export async function retryAdminRefund(
  paymentRefundId: string,
  adminId: string,
): Promise<RefundOutcome> {
  const refund = await fetchRefundRow(paymentRefundId);
  if (!refund) {
    throw new PaymentServiceError('REFUND_NOT_FOUND', 'Remboursement introuvable.', 404);
  }
  if (refund.status === 'succeeded') {
    throw new PaymentServiceError(
      'REFUND_ALREADY_SUCCEEDED',
      'Ce remboursement a déjà abouti.',
      400,
    );
  }
  if (refund.status !== 'failed' && refund.status !== 'manual_required') {
    throw new PaymentServiceError(
      'REFUND_IN_FLIGHT',
      'Ce remboursement est encore en cours : utilisez « Vérifier ».',
      409,
      { status: refund.status },
    );
  }

  const payment = await fetchPaymentRow(refund.payment_id);
  if (!payment || payment.status !== 'succeeded') {
    throw new PaymentServiceError(
      'PAYMENT_NOT_REFUNDABLE',
      "Le paiement source n'est plus remboursable.",
      409,
      { paymentStatus: payment?.status ?? null },
    );
  }
  if (!payment.provider_payment_id) {
    throw new PaymentServiceError(
      'REFUND_MANUAL_REQUIRED',
      "Paiement sans identifiant provider : remboursement manuel requis.",
      409,
    );
  }

  const reservationId = refund.reservation_id ?? payment.reservation_id;
  if (!reservationId) {
    throw new PaymentServiceError(
      'PAYMENT_NOT_REFUNDABLE',
      "Ce remboursement n'est rattaché à aucune réservation.",
      409,
    );
  }

  if (refund.status === 'manual_required') {
    const { error } = await supabaseAdmin.rpc('payment_cancel_refund', {
      p_refund_id: refund.id,
    });
    if (error) {
      if (error.message?.includes('REFUND_ALREADY_COMPLETED')) {
        return {
          requested: false,
          status: 'succeeded',
          refundId: null,
          reason: 'already_refunded',
        };
      }
      throw new PaymentServiceError(
        'PAYMENT_REFUND_FAILED',
        `Impossible de libérer l'ancien remboursement : ${error.message}`,
        500,
      );
    }
  }

  const outcome = await requestReservationRefund({
    reservationId,
    reason: refund.reason as RefundReason,
    reasonDetails: refund.reason_details,
    requestedBy: `admin:${adminId}`,
  });

  // Une nouvelle demande (ou un remboursement déjà vivant) remplace cette
  // tentative : marquer l'ancienne ligne « annulée » évite qu'elle reste
  // éternellement dans « Remboursements à traiter » et qu'on la relance en
  // boucle. L'historique de la nouvelle ligne porte l'action admin.
  if (outcome.refundId || outcome.reason === 'already_refunded') {
    const { error: supersedeError } = await supabaseAdmin
      .from('payment_refunds')
      .update({
        status: 'canceled',
        provider_status: 'superseded_by_retry',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund.id);
    if (supersedeError) {
      console.warn('[refund-admin] impossible de marquer la ligne remplacée', {
        refundId: refund.id,
        error: supersedeError.message,
      });
    }
  }

  return outcome;
}

/**
 * Relit l'état réel d'un remboursement chez pawaPay et applique la même
 * transition que le webhook. Utile quand un webhook a été perdu.
 */
export async function syncAdminRefund(
  paymentRefundId: string,
): Promise<SyncAdminRefundResult> {
  const refund = await fetchRefundRow(paymentRefundId);
  if (!refund) {
    throw new PaymentServiceError('REFUND_NOT_FOUND', 'Remboursement introuvable.', 404);
  }
  if (refund.status === 'succeeded') {
    return { status: 'succeeded', synced: false };
  }
  if (!refund.provider_refund_id) {
    await supabaseAdmin
      .from('payment_refunds')
      .update({
        status: 'manual_required',
        provider_status: 'missing_provider_refund',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund.id);
    return { status: 'manual_required', synced: true, reason: 'missing_provider_refund' };
  }

  const provider = await getRefund(refund.provider_refund_id);
  const mapped: RefundProviderStatus =
    provider.status === 'COMPLETED'
      ? 'COMPLETED'
      : provider.status === 'REJECTED'
        ? 'REJECTED'
        : provider.status === 'FAILED'
          ? 'FAILED'
          : 'ACCEPTED';

  await applyRefundProviderStatus(refund.id, mapped);

  const refreshed = await fetchRefundRow(refund.id);
  return { status: refreshed?.status ?? 'processing', synced: true };
}
