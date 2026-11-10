/**
 * Paiement d'une réservation (phase 3).
 *
 * Décision produit : la plateforme encaisse la TOTALITÉ du séjour au moment de
 * la demande, puis reverse au gérant après le séjour. Le gérant confirme ou
 * refuse ensuite une réservation déjà payée ; un refus déclenche un
 * remboursement total.
 */

import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import { isMarketSupported } from '../pawapay/config';
import { PaymentServiceError } from '../errors';
import type { PawapayCurrency } from '../types';
import { createCheckout } from './checkout';
import { lookupProviderPayment } from './providerStatus';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFERENCE_RE = /^PAY-\d{4}-[A-Z0-9]+$/;

export interface BookingPaymentSession {
  readonly reference: string;
  readonly checkoutUrl: string;
  readonly redirectUrl?: string;
  readonly checkoutId?: string;
  readonly amount: number;
  readonly currency: PawapayCurrency;
  readonly amountXof: number;
  readonly expiresAt: string;
}

export type BookingPaymentStart =
  | { readonly state: 'checkout'; readonly session: BookingPaymentSession }
  | { readonly state: 'paid'; readonly reference: string | null }
  | { readonly state: 'unavailable'; readonly reason: 'online_payment_disabled' };

interface ReservationRow {
  id: string;
  room_id: string;
  montant: number;
  statut: string;
  payment_status: string;
  payment_id: string | null;
}

interface RoomRow {
  id: string;
  market: MarketCode;
  gerant_id: string | null;
  title: string;
}

interface PaymentRow {
  id: string;
  reference: string;
  purpose: string;
  status: string;
  amount: number;
  currency: PawapayCurrency;
  reservation_id: string | null;
  provider_payment_link_id: string | null;
  fulfilled_at: string | null;
}

interface RpcClaimRow {
  payment_id: string;
  reservation_id: string | null;
  already_claimed: boolean;
}

export interface BookingConfirmation {
  readonly alreadyPaid: boolean;
  readonly paymentStatus: string;
  readonly paidAt: string | null;
  readonly reservation: Record<string, unknown> | null;
}

const RESERVATION_PAYMENT_COLUMNS =
  'id, room_id, montant, statut, payment_status, payment_id';

async function fetchReservation(reservationId: string): Promise<ReservationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select(RESERVATION_PAYMENT_COLUMNS)
    .eq('id', reservationId)
    .maybeSingle();
  if (error) throw error;
  return (data as ReservationRow | null) ?? null;
}

async function fetchRoom(roomId: string): Promise<RoomRow | null> {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, market, gerant_id, title')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data as RoomRow | null) ?? null;
}

async function findPaymentId(reference: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

async function attachPaymentToReservation(
  reservationId: string,
  paymentId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('reservations')
    .update({ payment_status: 'pending', payment_id: paymentId })
    .eq('id', reservationId)
    .in('payment_status', ['unpaid', 'failed', 'pending']);
  if (error) throw error;
}

export async function startBookingPayment(reservationId: string): Promise<BookingPaymentStart> {
  if (!UUID_RE.test(reservationId)) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Réservation introuvable.', 404);
  }

  const reservation = await fetchReservation(reservationId);
  if (!reservation) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Réservation introuvable.', 404);
  }
  if (reservation.statut === 'annulee') {
    throw new PaymentServiceError('PAYMENT_NOT_PAYABLE', 'Cette réservation est annulée.', 409);
  }
  if (reservation.payment_status === 'paid' || reservation.payment_status === 'deposit_paid') {
    const { data } = await supabaseAdmin
      .from('payments')
      .select('reference')
      .eq('reservation_id', reservation.id)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { state: 'paid', reference: (data as { reference?: string } | null)?.reference ?? null };
  }

  const room = await fetchRoom(reservation.room_id);
  if (!room) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Chambre introuvable.', 404);
  }

  if (!isMarketSupported(room.market)) {
    return { state: 'unavailable', reason: 'online_payment_disabled' };
  }

  const session = await createCheckout({
    purpose: 'booking',
    market: room.market,
    amountXof: reservation.montant,
    payerType: 'client',
    gerantClerkUserId: room.gerant_id,
    reservationId: reservation.id,
    description: `Séjour — ${room.title}`,
    returnPath: `/${room.market.toLowerCase()}/reservation/paiement`,
    failurePath: `/${room.market.toLowerCase()}/reservation/paiement`,
    metadata: { reservation_id: reservation.id },
    reusePendingPayment: true,
  });

  // CORRECTIF : lève si introuvable (plus de payment_id = null silencieux).
  const paymentId = await findPaymentId(session.reference);
  if (!paymentId) {
    throw new PaymentServiceError(
      'PAYMENT_CREATE_FAILED',
      'Paiement introuvable après création du checkout.',
      500,
      { reference: session.reference, reservation_id: reservation.id },
    );
  }
  await attachPaymentToReservation(reservation.id, paymentId);

  return {
    state: 'checkout',
    session: {
      reference: session.reference,
      checkoutUrl: session.checkoutUrl,
      redirectUrl: session.redirectUrl ?? session.checkoutUrl,
      checkoutId: session.checkoutId,
      amount: session.amount,
      currency: session.currency,
      amountXof: session.amountXof,
      expiresAt: session.expiresAt,
    },
  };
}

async function fetchPayment(reference: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(
      'id, reference, purpose, status, amount, currency, reservation_id, provider_payment_link_id, fulfilled_at',
    )
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentRow | null) ?? null;
}

async function buildConfirmation(
  reservationId: string | null,
  alreadyPaid: boolean,
): Promise<BookingConfirmation> {
  if (!reservationId) {
    return { alreadyPaid, paymentStatus: 'paid', paidAt: null, reservation: null };
  }

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('id, room_title, date_debut, date_fin, montant, statut, payment_status, paid_at')
    .eq('id', reservationId)
    .maybeSingle();
  if (error) throw error;

  const reservation = (data as Record<string, unknown> | null) ?? null;
  return {
    alreadyPaid,
    paymentStatus:
      (reservation?.payment_status as string | undefined) ?? (alreadyPaid ? 'paid' : 'pending'),
    paidAt: (reservation?.paid_at as string | null | undefined) ?? null,
    reservation,
  };
}

function rpcError(error: { message?: string; code?: string }): PaymentServiceError {
  const message = error.message ?? 'Activation de la réservation impossible';
  if (message.includes('PAYMENT_NOT_FOUND'))
    return new PaymentServiceError('PAYMENT_NOT_FOUND', 'Paiement introuvable.', 404);
  if (message.includes('PAYMENT_NOT_BOOKING'))
    return new PaymentServiceError('PAYMENT_NOT_BOOKING', 'Paiement non lié à une réservation.', 400);
  if (message.includes('PAYMENT_AMOUNT_MISMATCH'))
    return new PaymentServiceError(
      'PAYMENT_AMOUNT_MISMATCH',
      'Le montant reçu ne correspond pas au paiement attendu.',
      409,
    );
  if (message.includes('PAYMENT_NOT_PAYABLE'))
    return new PaymentServiceError(
      'PAYMENT_NOT_PAYABLE',
      'Ce paiement ne peut plus être activé.',
      409,
    );
  return new PaymentServiceError('PAYMENT_NOT_SUCCEEDED', message, 500);
}

export async function confirmBookingPayment(reference: string): Promise<BookingConfirmation> {
  if (!REFERENCE_RE.test(reference)) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Paiement introuvable.', 404);
  }

  const payment = await fetchPayment(reference);
  if (!payment) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Paiement introuvable.', 404);
  }
  if (payment.purpose !== 'booking') {
    throw new PaymentServiceError(
      'PAYMENT_NOT_BOOKING',
      "Ce paiement n'est pas une réservation.",
      400,
    );
  }

  if (payment.status === 'succeeded' && payment.fulfilled_at) {
    return buildConfirmation(payment.reservation_id, true);
  }

  const { payment: providerPayment, latestStatus } = await lookupProviderPayment(reference);

  if (!providerPayment) {
    throw new PaymentServiceError(
      'PAYMENT_NOT_SUCCEEDED',
      "Le paiement n'a pas encore été confirmé par pawaPay.",
      400,
      { status: latestStatus },
    );
  }

  const { data, error } = await supabaseAdmin.rpc('payment_claim_booking', {
    p_reference: payment.reference,
    p_provider_payment_id: providerPayment.id,
    p_amount: providerPayment.amount ?? payment.amount,
    p_currency: providerPayment.currency ?? payment.currency,
  });

  if (error) throw rpcError(error);

  const row = (Array.isArray(data) ? data[0] : data) as RpcClaimRow | undefined;
  return buildConfirmation(
    row?.reservation_id ?? payment.reservation_id,
    row?.already_claimed === true,
  );
}