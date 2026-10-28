/**
 * Flux Premium Hub2.
 *
 * Deux chemins convergent vers la même RPC atomique
 * `payment_claim_premium(reference, …)` :
 *
 *   - le webhook `payment_intent.succeeded` (nominal) ;
 *   - le retour navigateur `/api/premium/confirm` (secours), qui interroge
 *     Hub2 par `purchaseReference` quand la base n'a pas encore été mise à
 *     jour.
 *
 * Le second reçoit `already_claimed = true` si le premier est déjà passé :
 * l'abonnement n'est jamais prolongé deux fois.
 */

import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import { getHub2Config } from '../config';
import { PaymentServiceError } from '../errors';
import type { CheckoutSession, Hub2Currency } from '../types';
import { GERANT_COLUMNS } from '../../utils/gerantSelect';
import { createCheckout } from './checkout';
import { lookupProviderPayment } from './providerStatus';

export const PREMIUM_AMOUNT_XOF = 5_000;
export const PREMIUM_DURATION_DAYS = 30;

interface PaymentRow {
  id: string;
  reference: string;
  purpose: string;
  status: string;
  amount: number;
  currency: Hub2Currency;
  amount_xof: number;
  gerant_clerk_user_id: string | null;
  provider_payment_link_id: string | null;
  fulfilled_at: string | null;
}

interface RpcClaimRow {
  payment_id: string;
  already_claimed: boolean;
  new_expires_at: string | null;
  gerant_clerk_user_id: string | null;
  market: string | null;
}

export interface PremiumConfirmation {
  alreadyActive: boolean;
  expiresAt: string | null;
  gerant: Record<string, unknown> | null;
}

/** Crée (ou réutilise) un checkout Premium pour le gérant connecté. */
export async function createPremiumCheckout(input: {
  market: MarketCode;
  clerkUserId: string;
  email: string;
}): Promise<CheckoutSession> {
  return createCheckout({
    purpose: 'premium',
    market: input.market,
    amountXof: PREMIUM_AMOUNT_XOF,
    payerType: 'gerant',
    payerClerkUserId: input.clerkUserId,
    gerantClerkUserId: input.clerkUserId,
    description: `Abonnement Premium ${input.market} - ${PREMIUM_DURATION_DAYS} jours`,
    returnPath: `/${input.market.toLowerCase()}/gerant/premium/success`,
    failurePath: `/${input.market.toLowerCase()}/gerant/premium`,
    metadata: { email: input.email },
    reusePendingPayment: true,
  });
}

async function fetchPayment(reference: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(
      'id, reference, purpose, status, amount, currency, amount_xof, gerant_clerk_user_id, provider_payment_link_id, fulfilled_at',
    )
    .eq('reference', reference)
    .maybeSingle();

  if (error) throw error;
  return (data as PaymentRow | null) ?? null;
}

async function fetchGerant(clerkUserId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select(GERANT_COLUMNS)
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}

function assertOwnership(payment: PaymentRow, clerkUserId: string): void {
  if (payment.gerant_clerk_user_id !== clerkUserId) {
    throw new PaymentServiceError(
      'PAYMENT_FORBIDDEN',
      'Cette transaction ne vous appartient pas.',
      403,
    );
  }
}

function assertPremium(payment: PaymentRow): void {
  if (payment.purpose !== 'premium') {
    throw new PaymentServiceError(
      'PAYMENT_NOT_PREMIUM',
      "Cette transaction n'est pas éligible à l'abonnement premium.",
      400,
    );
  }
}

function rpcError(error: { message?: string; code?: string }): PaymentServiceError {
  const message = error.message ?? 'Activation premium impossible';
  if (message.includes('PAYMENT_NOT_FOUND')) {
    return new PaymentServiceError('PAYMENT_NOT_FOUND', 'Paiement introuvable.', 404);
  }
  if (message.includes('PAYMENT_NOT_PREMIUM')) {
    return new PaymentServiceError('PAYMENT_NOT_PREMIUM', 'Paiement non premium.', 400);
  }
  if (message.includes('PAYMENT_AMOUNT_MISMATCH')) {
    return new PaymentServiceError(
      'PAYMENT_AMOUNT_MISMATCH',
      'Le montant reçu ne correspond pas au paiement attendu.',
      409,
    );
  }
  if (message.includes('PAYMENT_NOT_PAYABLE')) {
    return new PaymentServiceError(
      'PAYMENT_NOT_PAYABLE',
      'Ce paiement ne peut plus être activé.',
      409,
    );
  }
  return new PaymentServiceError('PAYMENT_NOT_SUCCEEDED', message, 500);
}

async function claimPremium(
  payment: PaymentRow,
  providerPaymentId: string | null,
  amount: number = payment.amount,
  currency: string = payment.currency,
): Promise<RpcClaimRow> {
  const { data, error } = await supabaseAdmin.rpc('payment_claim_premium', {
    p_reference: payment.reference,
    p_provider_payment_id: providerPaymentId,
    p_amount: amount,
    p_currency: currency,
    p_days: PREMIUM_DURATION_DAYS,
  });

  if (error) throw rpcError(error);

  const row = (Array.isArray(data) ? data[0] : data) as RpcClaimRow | undefined;
  if (!row) {
    throw new PaymentServiceError(
      'PAYMENT_NOT_SUCCEEDED',
      'Activation premium : réponse vide.',
      500,
    );
  }
  return row;
}

/**
 * Confirme un paiement Premium depuis le retour navigateur.
 *
 * @throws PaymentServiceError (404/403/400/409/500)
 * @throws Hub2ConfigError (clés Hub2 absentes → 503 côté route)
 */
export async function confirmPremiumPayment(
  reference: string,
  clerkUserId: string,
): Promise<PremiumConfirmation> {
  const payment = await fetchPayment(reference);
  if (!payment) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Paiement introuvable.', 404);
  }
  assertOwnership(payment, clerkUserId);
  assertPremium(payment);

  // Déjà activé par le webhook : aucune requête réseau nécessaire.
  if (payment.status === 'succeeded' && payment.fulfilled_at) {
    const gerant = await fetchGerant(clerkUserId);
    return {
      alreadyActive: true,
      expiresAt: (gerant?.premium_expires_at as string | null | undefined) ?? null,
      gerant,
    };
  }

  const { payment: providerPayment, latestStatus } = await lookupProviderPayment(
    getHub2Config(),
    reference,
    payment.provider_payment_link_id,
  );

  if (!providerPayment) {
    throw new PaymentServiceError(
      'PAYMENT_NOT_SUCCEEDED',
      "Le paiement n'a pas encore été confirmé par Hub2.",
      400,
      { status: latestStatus },
    );
  }

  const claim = await claimPremium(
    payment,
    providerPayment.id,
    providerPayment.amount ?? payment.amount,
    providerPayment.currency ?? payment.currency,
  );
  const gerant = await fetchGerant(clerkUserId);

  return {
    alreadyActive: claim.already_claimed,
    expiresAt:
      claim.new_expires_at ??
      (gerant?.premium_expires_at as string | null | undefined) ??
      null,
    gerant,
  };
}
