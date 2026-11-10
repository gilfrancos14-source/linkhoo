/**
 * Gestion des remboursements pawaPay.
 *
 * CORRECTIF : `updateRefundInDatabase` ne rétrograde plus un `succeeded`.
 * `checkAndCompleteRefund` ne retourne `true` que sur état terminal.
 */

import { supabaseAdmin } from '../../config/supabase';
import { getPawapayConfig } from './config';
import { PawapayClient } from './client';
import { logger } from '../../lib/logger';
import { PaymentServiceError } from '../errors';
import { createRefundId } from './utils';
import type {
  PawapayCurrency,
  PawapayFailureReason,
  RefundLookupResult,
  RefundResource,
} from './types';

export type PawapayRefund = RefundResource;

export interface CreateRefundInput {
  depositId: string;
  amount: number;
  currency: PawapayCurrency;
  paymentRefundId?: string;
}

export interface CreateRefundResult {
  refundId: string;
  depositId: string;
  amount: string;
  currency: string;
  status: string;
  created: string;
  failureReason?: PawapayFailureReason;
}

export async function createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
  const config = getPawapayConfig();
  const client = new PawapayClient(config);

  const refundId = createRefundId();

  if (input.paymentRefundId) {
    const { data: existing } = await supabaseAdmin
      .from('payment_refunds')
      .select('provider_refund_id')
      .eq('id', input.paymentRefundId)
      .maybeSingle();

    if (existing?.provider_refund_id) {
      return {
        refundId: existing.provider_refund_id,
        depositId: input.depositId,
        amount: String(input.amount),
        currency: input.currency,
        status: 'ACCEPTED',
        created: new Date().toISOString(),
      };
    }

    // Persisté AVANT l'appel : un callback peut arriver avant la réponse.
    const { error: reserveError } = await supabaseAdmin
      .from('payment_refunds')
      .update({ provider_refund_id: refundId, provider_status: 'ACCEPTED' })
      .eq('id', input.paymentRefundId);
    if (reserveError) {
      throw new PaymentServiceError(
        'REFUND_UPDATE_FAILED',
        `Impossible de réserver le remboursement pawaPay : ${reserveError.message}`,
        500,
        { paymentRefundId: input.paymentRefundId },
      );
    }
  }

  const response = await client.createRefund({
    refundId,
    depositId: input.depositId,
    amount: input.amount.toFixed(0),
    currency: input.currency,
  });

  logger.info('Remboursement pawaPay initié', {
    refundId,
    depositId: input.depositId,
    status: response.status,
  });

  return {
    refundId,
    depositId: input.depositId,
    amount: response.amount ?? input.amount.toFixed(0),
    currency: response.currency ?? input.currency,
    status: response.status,
    created: response.created,
    failureReason: response.failureReason,
  };
}

export async function getRefund(refundId: string): Promise<RefundResource> {
  const config = getPawapayConfig();
  const client = new PawapayClient(config);

  const lookup: RefundLookupResult = await client.getRefundStatus(refundId);

  if (lookup.status !== 'FOUND') {
    throw new PaymentServiceError(
      'REFUND_FETCH_FAILED',
      `Remboursement pawaPay introuvable : ${refundId}`,
      404,
      { refundId },
    );
  }

  return lookup.data;
}

/**
 * CORRECTIF : ne rétrograde jamais un `succeeded`. `completed_at` uniquement
 * sur COMPLETED.
 */
export async function updateRefundInDatabase(
  paymentRefundId: string,
  status: 'ACCEPTED' | 'COMPLETED' | 'FAILED',
): Promise<void> {
  const isCompleted = status === 'COMPLETED';
  const newStatus =
    status === 'COMPLETED' ? 'succeeded' : status === 'FAILED' ? 'failed' : 'processing';

  let query = supabaseAdmin
    .from('payment_refunds')
    .update({
      provider_status: status,
      status: newStatus,
      ...(isCompleted ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentRefundId);

  if (!isCompleted) {
    query = query.neq('status', 'succeeded');
  }

  const { error: updateError } = await query;

  if (updateError) {
    throw new PaymentServiceError(
      'REFUND_UPDATE_FAILED',
      `Impossible de mettre à jour le remboursement : ${updateError.message}`,
      500,
      { paymentRefundId, status },
    );
  }

  logger.info('Remboursement mis à jour', { paymentRefundId, status });
}

/**
 * CORRECTIF : ne retourne `true` que sur état terminal.
 */
export async function checkAndCompleteRefund(
  paymentRefundId: string,
  refundId: string,
): Promise<boolean> {
  const refund = await getRefund(refundId);

  if (refund.status === 'COMPLETED') {
    await updateRefundInDatabase(paymentRefundId, 'COMPLETED');
    return true;
  }
  if (refund.status === 'FAILED' || refund.status === 'REJECTED') {
    await updateRefundInDatabase(paymentRefundId, 'FAILED');
    return true;
  }
  // ACCEPTED / DUPLICATE_IGNORED : encore en cours, ne pas clore.
  return false;
}