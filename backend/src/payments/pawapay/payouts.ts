/**
 * Gestion des reversements pawaPay.
 *
 * CORRECTIF : `updatePayoutInDatabase` ne rétrograde plus un `paid`.
 * `checkAndCompletePayout` ne retourne `true` que sur état terminal
 * (COMPLETED / FAILED / REJECTED). Un ACCEPTED/ENQUEUED n'est PAS final
 * et doit continuer à être pollé.
 */

import { supabaseAdmin } from '../../config/supabase';
import { getPawapayConfig } from './config';
import { PawapayClient } from './client';
import { logger } from '../../lib/logger';
import { PaymentServiceError } from '../errors';
import { createPayoutId } from './utils';
import type {
  PawapayCurrency,
  PawapayFailureReason,
  PayoutLookupResult,
  PayoutResource,
} from './types';

export type PawapayPayout = PayoutResource;

export interface CreatePayoutInput {
  amount: number;
  currency: PawapayCurrency;
  phoneNumber: string;
  provider: string;
  paymentPayoutId?: string;
  metadata?: Record<string, string>;
}

export interface CreatePayoutResult {
  payoutId: string;
  amount: string;
  currency: string;
  status: string;
  created: string;
  failureReason?: PawapayFailureReason;
}

export async function createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
  const config = getPawapayConfig();
  const client = new PawapayClient(config);

  const payoutId = createPayoutId();

  if (input.paymentPayoutId) {
    const { data: existing } = await supabaseAdmin
      .from('payment_payouts')
      .select('provider_transfer_id')
      .eq('id', input.paymentPayoutId)
      .maybeSingle();

    if (existing?.provider_transfer_id) {
      return {
        payoutId: existing.provider_transfer_id,
        amount: String(input.amount),
        currency: input.currency,
        status: 'ACCEPTED',
        created: new Date().toISOString(),
      };
    }

    // Persisté AVANT l'appel : un callback peut arriver avant la réponse.
    const { error: reserveError } = await supabaseAdmin
      .from('payment_payouts')
      .update({ provider_transfer_id: payoutId, status: 'processing' })
      .eq('id', input.paymentPayoutId);
    if (reserveError) {
      throw new PaymentServiceError(
        'PAYOUT_UPDATE_FAILED',
        `Impossible de réserver le virement pawaPay : ${reserveError.message}`,
        500,
        { paymentPayoutId: input.paymentPayoutId },
      );
    }
  }

  // pawaPay attend un tableau d'objets à clé libre : `[{ orderId: "…" }]`,
  // pas `[{ name, value }]`.
  const metadataEntries = Object.entries(input.metadata ?? {}).map(([key, value]) => ({
    [key.slice(0, 30)]: String(value).slice(0, 200),
  }));

  const response = await client.createPayout({
    payoutId,
    amount: input.amount.toFixed(0),
    currency: input.currency,
    recipient: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: input.phoneNumber,
        provider: input.provider,
      },
    },
    metadata: metadataEntries.length > 0 ? metadataEntries.slice(0, 10) : undefined,
  });

  logger.info('Reversement pawaPay initié', {
    payoutId,
    status: response.status,
    provider: input.provider,
  });

  return {
    payoutId,
    amount: response.amount ?? input.amount.toFixed(0),
    currency: response.currency ?? input.currency,
    status: response.status,
    created: response.created,
    failureReason: response.failureReason,
  };
}

export async function getPayout(payoutId: string): Promise<PayoutResource> {
  const config = getPawapayConfig();
  const client = new PawapayClient(config);

  const lookup: PayoutLookupResult = await client.getPayoutStatus(payoutId);

  if (lookup.status !== 'FOUND') {
    throw new PaymentServiceError(
      'PAYOUT_FETCH_FAILED',
      `Reversement pawaPay introuvable : ${payoutId}`,
      404,
      { payoutId },
    );
  }

  return lookup.data;
}

/**
 * CORRECTIF : ne rétrograde jamais un `paid`. `paid_at` uniquement sur COMPLETED.
 */
export async function updatePayoutInDatabase(
  paymentPayoutId: string,
  status: 'ACCEPTED' | 'ENQUEUED' | 'COMPLETED' | 'FAILED',
): Promise<void> {
  const mappedStatus =
    status === 'COMPLETED' ? 'paid' : status === 'FAILED' ? 'failed' : 'processing';
  const isCompleted = status === 'COMPLETED';

  let query = supabaseAdmin
    .from('payment_payouts')
    .update({
      status: mappedStatus,
      ...(isCompleted ? { paid_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentPayoutId);

  if (!isCompleted) {
    query = query.neq('status', 'paid');
  }

  const { error: updateError } = await query;

  if (updateError) {
    throw new PaymentServiceError(
      'PAYOUT_UPDATE_FAILED',
      `Impossible de mettre à jour le reversement : ${updateError.message}`,
      500,
      { paymentPayoutId, status },
    );
  }

  logger.info('Reversement mis à jour', { paymentPayoutId, status });
}

/**
 * CORRECTIF : ne retourne `true` que sur état terminal.
 */
export async function checkAndCompletePayout(
  paymentPayoutId: string,
  payoutId: string,
): Promise<boolean> {
  const payout = await getPayout(payoutId);

  if (payout.status === 'COMPLETED') {
    await updatePayoutInDatabase(paymentPayoutId, 'COMPLETED');
    return true;
  }
  if (payout.status === 'FAILED' || payout.status === 'REJECTED') {
    await updatePayoutInDatabase(paymentPayoutId, 'FAILED');
    return true;
  }
  // ACCEPTED / ENQUEUED / DUPLICATE_IGNORED : encore en cours, ne pas clore.
  return false;
}