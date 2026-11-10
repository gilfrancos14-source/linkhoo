/**
 * Création d'une session de paiement pawaPay.
 */

import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import { PaymentServiceError } from '../errors';
import { createPawapayCheckout, resolveFxRate } from '../pawapay/checkouts';
import { getMarketPaymentConfig, getPawapayConfig, isMarketSupported } from '../pawapay/config';
import { PawapayApiError } from '../pawapay/client';
import { paymentReturnBaseUrl } from '../returnUrl';
import type { CheckoutSession, PayerType, PaymentPurpose } from '../types';

const MAX_AMOUNT_XOF = 10_000_000;

export interface CreateCheckoutInput {
  readonly purpose: PaymentPurpose;
  readonly market: MarketCode;
  readonly amountXof: number;
  readonly payerType: PayerType;
  readonly payerClerkUserId?: string | null;
  readonly gerantClerkUserId?: string | null;
  readonly clientId?: string | null;
  readonly reservationId?: string | null;
  readonly boostId?: string | null;
  readonly description: string;
  readonly returnPath: string;
  readonly failurePath?: string;
  readonly metadata?: Record<string, unknown>;
  readonly reusePendingPayment?: boolean;
}

export function buildPaymentReference(now: Date = new Date()): string {
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  return `PAY-${now.getUTCFullYear()}-${suffix}`;
}

function publicBaseUrl(): string {
  return paymentReturnBaseUrl();
}

export function buildPublicUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new PaymentServiceError(
      'PAYMENT_CREATE_FAILED',
      `Chemin de retour invalide : ${path}`,
      500,
    );
  }
  return `${publicBaseUrl()}${path}`;
}

interface PendingPaymentRow {
  reference: string;
  checkout_url: string | null;
  amount: number;
  currency: CheckoutSession['currency'];
  amount_xof: number;
  fx_rate: number | string;
  expires_at: string | null;
}

async function findReusablePayment(
  input: CreateCheckoutInput,
): Promise<CheckoutSession | null> {
  if (!input.reusePendingPayment) return null;
  if (!input.reservationId && !input.gerantClerkUserId) return null;

  let query = supabaseAdmin
    .from('payments')
    .select('reference, checkout_url, amount, currency, amount_xof, fx_rate, expires_at')
    .eq('purpose', input.purpose)
    .eq('amount_xof', input.amountXof)
    .in('status', ['created', 'pending', 'requires_action'])
    .gt('expires_at', new Date().toISOString());

  query = input.reservationId
    ? query.eq('reservation_id', input.reservationId)
    : query.eq('gerant_clerk_user_id', input.gerantClerkUserId as string);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const row = data as PendingPaymentRow | null;
  if (!row?.checkout_url) return null;

  return {
    reference: row.reference,
    checkoutUrl: row.checkout_url,
    amount: Number(row.amount),
    currency: row.currency,
    amountXof: Number(row.amount_xof),
    fxRate: Number(row.fx_rate),
    expiresAt: row.expires_at ?? '',
  };
}

export async function createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
  if (!Number.isInteger(input.amountXof) || input.amountXof <= 0) {
    throw new PaymentServiceError('PAYMENT_CREATE_FAILED', 'Montant XOF invalide.', 400);
  }
  if (input.amountXof > MAX_AMOUNT_XOF) {
    throw new PaymentServiceError(
      'PAYMENT_CREATE_FAILED',
      `Montant XOF hors limites (max ${MAX_AMOUNT_XOF}).`,
      400,
    );
  }

  if (!isMarketSupported(input.market)) {
    throw new PaymentServiceError(
      'ONLINE_PAYMENT_DISABLED',
      `Le paiement en ligne n'est pas disponible sur le marché ${input.market}.`,
      422,
      { market: input.market },
    );
  }

  const reusable = await findReusablePayment(input);
  if (reusable) return reusable;

  getPawapayConfig();

  const marketConfig = getMarketPaymentConfig(input.market);
  const chargeCurrency = marketConfig.currency;
  const fxRate = await resolveFxRate(input.market, chargeCurrency);
  const amount = Math.round(input.amountXof * fxRate);

  const reference = buildPaymentReference();
  const now = new Date();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert({
      reference,
      purpose: input.purpose,
      provider: 'pawapay',
      payer_type: input.payerType,
      payer_clerk_user_id: input.payerClerkUserId ?? null,
      gerant_clerk_user_id: input.gerantClerkUserId ?? null,
      client_id: input.clientId ?? null,
      reservation_id: input.reservationId ?? null,
      boost_id: input.boostId ?? null,
      market: input.market,
      amount,
      currency: chargeCurrency,
      amount_xof: input.amountXof,
      fx_rate: fxRate,
      metadata: {
        ...input.metadata,
        return_path: input.returnPath,
        failure_path: input.failurePath ?? input.returnPath,
      },
      status: 'created',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('id')
    .single();

  if (insertError) {
    // Capture de la course sur l'index unique partiel.
    if ((insertError as { code?: string }).code === '23505') {
      const winner = await findReusablePayment(input);
      if (winner) return winner;
      throw new PaymentServiceError(
        'PAYMENT_CREATE_FAILED',
        'Un paiement existe déjà pour cette cible mais est introuvable.',
        500,
      );
    }
    throw new PaymentServiceError(
      'PAYMENT_CREATE_FAILED',
      `Impossible d'enregistrer le paiement : ${insertError.message}`,
      500,
    );
  }

  const paymentId = (inserted as { id?: string } | null)?.id;
  if (!paymentId) {
    throw new PaymentServiceError('PAYMENT_CREATE_FAILED', 'Paiement non enregistré.', 500);
  }

  let checkoutResult;
  try {
    checkoutResult = await createPawapayCheckout({
      paymentId,
      reference,
      market: input.market,
      amountXof: input.amountXof,
      description: input.description,
      returnPath: input.returnPath,
      failurePath: input.failurePath ?? input.returnPath,
      metadata: input.metadata,
    });

    const { error: pawapayUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        amount: checkoutResult.amount,
        currency: checkoutResult.currency,
        amount_xof: input.amountXof,
        fx_rate: checkoutResult.fxRate,
        expires_at: checkoutResult.expiresAt,
        pawapay_checkout_id: checkoutResult.checkoutId,
        checkout_url: checkoutResult.checkoutUrl,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (pawapayUpdateError) {
      try {
        await supabaseAdmin
          .from('payments')
          .update({
            status: 'failed',
            failure_code: 'checkout_persist_failed',
            failure_message: `Checkout pawaPay créé (${checkoutResult.checkoutId}) mais non enregistré : ${pawapayUpdateError.message}`.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId);
      } catch (markError) {
        console.error('[checkout] mark-failed impossible (pawaPay)', markError);
      }
      throw new PaymentServiceError(
        'PAYMENT_CREATE_FAILED',
        `Checkout créé mais non enregistré : ${pawapayUpdateError.message}`,
        500,
        { payment_id: paymentId, provider_checkout_id: checkoutResult.checkoutId },
      );
    }
  } catch (error) {
    // mark-failed protégé : l'erreur d'origine n'est pas masquée.
    const code =
      error instanceof PawapayApiError
        ? 'PAWAPAY_ERROR'
        : error instanceof Error
          ? error.name
          : 'PROVIDER_ERROR';
    const message = error instanceof Error ? error.message : 'Création du checkout impossible';

    try {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          failure_code: code,
          failure_message: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
    } catch (markError) {
      console.error('[checkout] mark-failed impossible (catch)', markError);
    }

    throw error;
  }

  return {
    reference: checkoutResult.reference,
    checkoutUrl: checkoutResult.checkoutUrl,
    redirectUrl: checkoutResult.redirectUrl ?? checkoutResult.checkoutUrl,
    checkoutId: checkoutResult.checkoutId,
    amount: checkoutResult.amount,
    currency: checkoutResult.currency,
    amountXof: checkoutResult.amountXof,
    fxRate: checkoutResult.fxRate,
    expiresAt: checkoutResult.expiresAt,
  };
}
