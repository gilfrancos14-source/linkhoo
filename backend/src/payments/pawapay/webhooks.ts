/**
 * Traitement des webhooks pawaPay.
 *
 * Toutes les transitions sont idempotentes et ne rétrogradent jamais un
 * paiement réussi. Un callback qui ne correspond à aucune ligne connue est
 * acquitté (200) sans traitement : inutile de faire rejouer indéfiniment un
 * événement orphelin. Seules les erreurs techniques (DB, réseau) remontent.
 */

import { supabaseAdmin } from '../../config/supabase';
import { logger } from '../../lib/logger';
import { PaymentServiceError } from '../errors';
import { claimSucceededPayment } from '../service/applyEvent';
import type {
  CheckoutResource,
  DepositResource,
  RefundResource,
  PayoutResource,
} from './types';

export type PawapayWebhookEvent =
  | { kind: 'checkout'; data: CheckoutResource }
  | { kind: 'deposit'; data: DepositResource }
  | { kind: 'refund'; data: RefundResource }
  | { kind: 'payout'; data: PayoutResource }
  | { kind: 'unknown' };

export interface PawapayWebhookResult {
  readonly handled: boolean;
  readonly reason?: string;
}

export function parsePawapayWebhook(body: unknown): PawapayWebhookEvent {
  if (typeof body !== 'object' || body === null) {
    return { kind: 'unknown' };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.checkoutId === 'string') {
    return { kind: 'checkout', data: body as CheckoutResource };
  }
  if (typeof record.depositId === 'string') {
    return { kind: 'deposit', data: body as DepositResource };
  }
  if (typeof record.refundId === 'string') {
    return { kind: 'refund', data: body as RefundResource };
  }
  if (typeof record.payoutId === 'string') {
    return { kind: 'payout', data: body as PayoutResource };
  }

  return { kind: 'unknown' };
}

const OPEN_PAYMENT_STATUSES = ['created', 'pending', 'requires_action'] as const;

interface PawapayPaymentRow {
  reference: string;
  purpose: string;
  amount: number | string;
  currency: string;
  status: string;
  fulfilled_at: string | null;
}

async function findPaymentBy(
  column: 'pawapay_checkout_id' | 'pawapay_deposit_id' | 'reference',
  value: string,
): Promise<PawapayPaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('reference, purpose, amount, currency, status, fulfilled_at')
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return (data as PawapayPaymentRow | null) ?? null;
}

function normalizeAnnouncedAmount(amount: unknown): number | null {
  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

/**
 * Applique le claim métier. Retourne `false` si le paiement est inconnu.
 */
async function claimCompletedPayment(
  payment: PawapayPaymentRow | null,
  providerPaymentId: string,
  announced: { amount?: unknown; currency?: unknown },
): Promise<boolean> {
  if (!payment) {
    logger.warn('Callback pawaPay COMPLETED pour un paiement inconnu', { providerPaymentId });
    return false;
  }
  if (payment.fulfilled_at) return true;

  const announcedAmount = normalizeAnnouncedAmount(announced.amount);
  const announcedCurrency =
    typeof announced.currency === 'string' && /^[A-Z]{3}$/.test(announced.currency)
      ? announced.currency
      : null;

  const claim = () =>
    claimSucceededPayment({
      reference: payment.reference,
      purpose: payment.purpose,
      providerPaymentId,
      amount: announcedAmount ?? normalizeAnnouncedAmount(payment.amount) ?? 0,
      currency: announcedCurrency ?? payment.currency,
    });

  try {
    await claim();
  } catch (error) {
    const message =
      typeof (error as { message?: unknown })?.message === 'string'
        ? (error as { message: string }).message
        : String(error);
    if (!message.includes('PAYMENT_NOT_PAYABLE')) throw error;

    const { error: resetError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('reference', payment.reference)
      .eq('status', 'failed');
    if (resetError) throw resetError;

    await claim();
  }

  return true;
}

/**
 * Cherche le dépôt COMPLETED dans `depositsHistory` (retry possible dans le
 * même checkout), puis fallback sur `checkout.deposit` si celui-ci est
 * COMPLETED. Ne JAMAIS utiliser `checkout.deposit` directement : il peut être
 * FAILED alors qu'une tentative précédente a réussi.
 */
export function findCompletedDeposit(checkout: CheckoutResource): {
  depositId: string;
  amount?: string;
  currency?: string;
  created?: string;
} | null {
  const history = checkout.depositsHistory ?? [];
  const completed = history.find((d) => d.status === 'COMPLETED');
  if (completed?.depositId) {
    return {
      depositId: completed.depositId,
      amount: completed.amount,
      currency: completed.currency,
      created: completed.created,
    };
  }
  if (checkout.deposit?.status === 'COMPLETED' && checkout.deposit.depositId) {
    return {
      depositId: checkout.deposit.depositId,
      amount: checkout.deposit.amount,
      currency: checkout.deposit.currency,
      created: checkout.deposit.created,
    };
  }
  return null;
}

async function applyCheckoutCallback(checkout: CheckoutResource): Promise<PawapayWebhookResult> {
  const statusMap: Record<string, string> = {
    WAITING_PAYMENT: 'pending',
    PROCESSING: 'pending',
    COMPLETED: 'succeeded',
    FAILED: 'failed',
    EXPIRED: 'expired',
    CANCELLED: 'canceled',
  };

  const payment =
    (await findPaymentBy('pawapay_checkout_id', checkout.checkoutId)) ??
    (checkout.clientReferenceId
      ? await findPaymentBy('reference', checkout.clientReferenceId)
      : null);

  if (!payment) {
    logger.warn('Callback checkout pawaPay pour un paiement inconnu', {
      checkoutId: checkout.checkoutId,
      clientReferenceId: checkout.clientReferenceId,
    });
    return { handled: false, reason: 'payment_not_found' };
  }

  const isCompleted = checkout.status === 'COMPLETED';

  let completedDeposit: ReturnType<typeof findCompletedDeposit> = null;
  if (isCompleted) {
    completedDeposit = findCompletedDeposit(checkout);
    if (!completedDeposit) {
      // Sans depositId COMPLETED, on ne peut ni activer le paiement ni
      // rembourser proprement. On laisse la réconciliation reprendre la main.
      logger.warn('Checkout COMPLETED sans dépôt COMPLETED exploitable', {
        checkoutId: checkout.checkoutId,
        depositsHistoryLength: checkout.depositsHistory?.length ?? 0,
      });
      return { handled: false, reason: 'missing_completed_deposit' };
    }

    const claimed = await claimCompletedPayment(payment, completedDeposit.depositId, {
      amount: completedDeposit.amount,
      currency: completedDeposit.currency,
    });
    if (!claimed) return { handled: false, reason: 'payment_not_found' };
  }

  const patch: Record<string, unknown> = {
    pawapay_status: checkout.status,
    ...(completedDeposit?.depositId ? { pawapay_deposit_id: completedDeposit.depositId } : {}),
    pawapay_failure_reason: checkout.deposit?.failureReason?.failureMessage ?? null,
    failure_code: checkout.deposit?.failureReason?.failureCode ?? null,
    failure_message: checkout.deposit?.failureReason?.failureMessage ?? null,
    updated_at: new Date().toISOString(),
  };
  if (isCompleted && completedDeposit) {
    patch.status = 'succeeded';
    patch.paid_at = completedDeposit.created ?? new Date().toISOString();
  } else {
    patch.status = statusMap[checkout.status] ?? 'pending';
  }

  let query = supabaseAdmin.from('payments').update(patch).eq('reference', payment.reference);
  if (!isCompleted) query = query.in('status', [...OPEN_PAYMENT_STATUSES]);

  const { error } = await query;

  if (error) {
    throw new PaymentServiceError(
      'PAYMENT_UPDATE_FAILED',
      `Impossible de mettre à jour le paiement : ${error.message}`,
      500,
      { checkoutId: checkout.checkoutId },
    );
  }

  logger.info('Checkout pawaPay traité', {
    checkoutId: checkout.checkoutId,
    status: checkout.status,
  });

  return { handled: true };
}

async function applyDepositCallback(deposit: DepositResource): Promise<PawapayWebhookResult> {
  const statusMap: Record<string, string> = {
    ACCEPTED: 'pending',
    PROCESSING: 'pending',
    IN_RECONCILIATION: 'pending',
    COMPLETED: 'succeeded',
    FAILED: 'failed',
  };

  const payment =
    (await findPaymentBy('pawapay_deposit_id', deposit.depositId)) ??
    (deposit.clientReferenceId
      ? await findPaymentBy('reference', deposit.clientReferenceId)
      : null);

  if (!payment) {
    logger.warn('Callback dépôt pawaPay pour un paiement inconnu', {
      depositId: deposit.depositId,
      clientReferenceId: deposit.clientReferenceId,
    });
    return { handled: false, reason: 'payment_not_found' };
  }

  const isCompleted = deposit.status === 'COMPLETED';

  if (isCompleted) {
    const claimed = await claimCompletedPayment(payment, deposit.depositId, {
      amount: deposit.amount,
      currency: deposit.currency,
    });
    if (!claimed) return { handled: false, reason: 'payment_not_found' };
  }

  const patch: Record<string, unknown> = {
    pawapay_status: deposit.status,
    pawapay_deposit_id: deposit.depositId,
    pawapay_failure_reason: deposit.failureReason?.failureMessage ?? null,
    failure_code: deposit.failureReason?.failureCode ?? null,
    failure_message: deposit.failureReason?.failureMessage ?? null,
    updated_at: new Date().toISOString(),
  };
  if (isCompleted) {
    patch.status = 'succeeded';
    patch.paid_at = deposit.created;
  } else {
    patch.status = statusMap[deposit.status] ?? 'pending';
  }

  let query = supabaseAdmin.from('payments').update(patch).eq('reference', payment.reference);
  if (!isCompleted) query = query.in('status', [...OPEN_PAYMENT_STATUSES]);

  const { error } = await query;

  if (error) {
    throw new PaymentServiceError(
      'PAYMENT_UPDATE_FAILED',
      `Impossible de mettre à jour le paiement : ${error.message}`,
      500,
      { depositId: deposit.depositId },
    );
  }

  logger.info('Dépôt pawaPay traité', {
    depositId: deposit.depositId,
    status: deposit.status,
  });

  return { handled: true };
}

async function applyRefundCallback(refund: RefundResource): Promise<PawapayWebhookResult> {
  const statusMap: Record<string, string> = {
    ACCEPTED: 'processing',
    COMPLETED: 'succeeded',
    FAILED: 'failed',
    REJECTED: 'failed',
    DUPLICATE_IGNORED: 'processing',
  };

  const newStatus = statusMap[refund.status] ?? 'processing';

  let query = supabaseAdmin
    .from('payment_refunds')
    .update({
      status: newStatus,
      provider_status: refund.status,
      completed_at: refund.status === 'COMPLETED' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_refund_id', refund.refundId);
  if (refund.status !== 'COMPLETED') query = query.neq('status', 'succeeded');

  const { data, error } = await query.select('id');

  if (error) {
    throw new PaymentServiceError(
      'REFUND_UPDATE_FAILED',
      `Impossible de mettre à jour le remboursement : ${error.message}`,
      500,
      { refundId: refund.refundId },
    );
  }

  if (!data || data.length === 0) {
    logger.warn('Callback remboursement pawaPay pour un remboursement inconnu', {
      refundId: refund.refundId,
      status: refund.status,
    });
    return { handled: false, reason: 'refund_not_found' };
  }

  logger.info('Remboursement pawaPay traité', {
    refundId: refund.refundId,
    status: refund.status,
  });

  return { handled: true };
}

async function applyPayoutCallback(payout: PayoutResource): Promise<PawapayWebhookResult> {
  const statusMap: Record<string, string> = {
    ACCEPTED: 'processing',
    ENQUEUED: 'processing',
    COMPLETED: 'paid',
    FAILED: 'failed',
    REJECTED: 'failed',
    DUPLICATE_IGNORED: 'processing',
  };

  const newStatus = statusMap[payout.status] ?? 'processing';
  const isCompleted = payout.status === 'COMPLETED';
  const isFailed = payout.status === 'FAILED' || payout.status === 'REJECTED';

  let query = supabaseAdmin
    .from('payment_payouts')
    .update({
      status: newStatus,
      ...(isCompleted ? { paid_at: payout.completed ?? new Date().toISOString() } : {}),
      failure_code: isFailed ? payout.failureReason?.failureCode ?? 'payout_failed' : null,
      failure_message: isFailed ? payout.failureReason?.failureMessage ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_transfer_id', payout.payoutId);

  query = isCompleted
    ? query.neq('status', 'paid')
    : query.in('status', ['scheduled', 'processing']);

  const { data, error } = await query.select('id');

  if (error) {
    throw new PaymentServiceError(
      'PAYOUT_UPDATE_FAILED',
      `Impossible de mettre à jour le reversement : ${error.message}`,
      500,
      { payoutId: payout.payoutId },
    );
  }

  if (!data || data.length === 0) {
    logger.warn('Callback reversement pawaPay pour un reversement inconnu', {
      payoutId: payout.payoutId,
      status: payout.status,
    });
    return { handled: false, reason: 'payout_not_found' };
  }

  logger.info('Reversement pawaPay traité', {
    payoutId: payout.payoutId,
    status: payout.status,
  });

  return { handled: true };
}

export async function processPawapayWebhook(body: unknown): Promise<PawapayWebhookResult> {
  const event = parsePawapayWebhook(body);

  if (event.kind === 'unknown') {
    logger.warn('Callback pawaPay non reconnu', { body });
    return { handled: false, reason: 'unsupported_event' };
  }

  switch (event.kind) {
    case 'checkout':
      return applyCheckoutCallback(event.data);
    case 'deposit':
      return applyDepositCallback(event.data);
    case 'refund':
      return applyRefundCallback(event.data);
    case 'payout':
      return applyPayoutCallback(event.data);
  }
}
