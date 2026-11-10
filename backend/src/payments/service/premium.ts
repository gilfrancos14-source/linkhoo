/**
 * Flux Premium pawaPay.
 */

import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import type { PawapayCurrency } from '../pawapay/types';
import { PaymentServiceError } from '../errors';
import type { CheckoutSession } from '../types';
import { GERANT_COLUMNS } from '../../utils/gerantSelect';
import { createCheckout } from './checkout';
import { lookupProviderPayment } from './providerStatus';
import {
  PREMIUM_PLANS,
  premiumDaysFromMetadata,
  resolvePremiumPlan,
  type PremiumPlanId,
} from '../premiumPlans';

export const PREMIUM_AMOUNT_XOF = PREMIUM_PLANS.monthly.amountXof;
export const PREMIUM_DURATION_DAYS = PREMIUM_PLANS.monthly.days;

interface PaymentRow {
  id: string;
  reference: string;
  purpose: string;
  status: string;
  amount: number;
  currency: PawapayCurrency;
  amount_xof: number;
  gerant_clerk_user_id: string | null;
  provider_payment_link_id: string | null;
  pawapay_checkout_id: string | null;
  fulfilled_at: string | null;
  metadata: Record<string, unknown> | null;
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

export async function createPremiumCheckout(input: {
  market: MarketCode;
  clerkUserId: string;
  email: string;
  plan?: PremiumPlanId;
}): Promise<CheckoutSession> {
  const plan = resolvePremiumPlan(input.plan);
  return createCheckout({
    purpose: 'premium',
    market: input.market,
    amountXof: plan.amountXof,
    payerType: 'gerant',
    payerClerkUserId: input.clerkUserId,
    gerantClerkUserId: input.clerkUserId,
    description: `Abonnement Premium ${plan.label} ${input.market} - ${plan.days} jours`,
    returnPath: `/${input.market.toLowerCase()}/gerant/premium/success`,
    failurePath: `/${input.market.toLowerCase()}/gerant/premium`,
    metadata: {
      email: input.email,
      premium_plan: plan.id,
      premium_days: plan.days,
    },
    reusePendingPayment: true,
  });
}

async function fetchPayment(reference: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(
      'id, reference, purpose, status, amount, currency, amount_xof, gerant_clerk_user_id, provider_payment_link_id, pawapay_checkout_id, fulfilled_at, metadata',
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
  if (message.includes('PAYMENT_NOT_FOUND'))
    return new PaymentServiceError('PAYMENT_NOT_FOUND', 'Paiement introuvable.', 404);
  if (message.includes('PAYMENT_NOT_PREMIUM'))
    return new PaymentServiceError('PAYMENT_NOT_PREMIUM', 'Paiement non premium.', 400);
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
    p_days: premiumDaysFromMetadata(payment.metadata),
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

  if (payment.status === 'succeeded' && payment.fulfilled_at) {
    const gerant = await fetchGerant(clerkUserId);
    return {
      alreadyActive: true,
      expiresAt: (gerant?.premium_expires_at as string | null | undefined) ?? null,
      gerant,
    };
  }

  const checkoutCode = payment.pawapay_checkout_id;
  if (!checkoutCode) {
    throw new PaymentServiceError(
      'PAYMENT_NOT_SUCCEEDED',
      "Le paiement n'a pas encore été confirmé par pawaPay.",
      400,
    );
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
