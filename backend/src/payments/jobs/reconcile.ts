/**
 * Réconciliation des paiements restés ouverts.
 *
 * Si le client ferme l'onglet avant le retour navigateur, le paiement peut
 * rester bloqué en `pending` : on relit l'état réel chez pawaPay pour le
 * clôturer (succès confirmé) ou le marquer terminal (`failed`, `canceled`,
 * `expired`).
 *
 * `'cancelled'` (2 L, pawaPay) est normalisé en `'canceled'` (1 L, DB) sinon
 * les checkouts pawaPay CANCELLED ne sont jamais clôturés.
 */

import { supabaseAdmin } from '../../config/supabase';
import { getPawapayConfig, PawapayConfigError } from '../pawapay/config';
import type { PawapayCurrency } from '../pawapay/types';
import {
  claimSucceededPayment,
  OPEN_PAYMENT_STATUSES,
  setPaymentStatusIfOpen,
  type NonTerminalStatus,
} from '../service/applyEvent';
import { lookupProviderPayment } from '../service/providerStatus';

export const RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;
export const RECONCILE_BATCH_SIZE = 50;

interface PendingPaymentRow {
  reference: string;
  purpose: string;
  amount: number;
  currency: PawapayCurrency;
}

export interface ReconcileResult {
  readonly checked: number;
  readonly claimed: number;
  readonly closed: number;
  readonly skipped: boolean;
}

// Inclure 'cancelled' (2 L, pawaPay) pour ne pas laisser les checkouts
// CANCELLED en `pending` éternel.
const TERMINAL_KINDS = new Set<string>(['failed', 'canceled', 'cancelled', 'expired']);

/** Normalise les alias provider vers les statuts DB (`canceled` à 1 L). */
function normalizeTerminalStatus(status: string): NonTerminalStatus | null {
  if (status === 'cancelled' || status === 'canceled') return 'canceled';
  if (status === 'failed') return 'failed';
  if (status === 'expired') return 'expired';
  return null;
}

export async function reconcilePendingPayments(
  now: Date = new Date(),
): Promise<ReconcileResult> {
  try {
    getPawapayConfig();
  } catch (error) {
    if (error instanceof PawapayConfigError) {
      console.warn(`[payments:reconcile] pawaPay non configuré : ${error.code}`);
      return { checked: 0, claimed: 0, closed: 0, skipped: true };
    }
    throw error;
  }

  const cutoff = new Date(now.getTime() - RECONCILE_MIN_AGE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('reference, purpose, amount, currency')
    .in('status', [...OPEN_PAYMENT_STATUSES])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(RECONCILE_BATCH_SIZE);

  if (error) throw error;

  const rows = (data as PendingPaymentRow[] | null) ?? [];
  let claimed = 0;
  let closed = 0;

  for (const payment of rows) {
    try {
      const { payment: providerPayment, latestStatus } = await lookupProviderPayment(
        payment.reference,
      );

      if (providerPayment) {
        await claimSucceededPayment({
          reference: payment.reference,
          purpose: payment.purpose,
          providerPaymentId: providerPayment.id,
          amount: providerPayment.amount ?? payment.amount,
          currency: providerPayment.currency ?? payment.currency,
        });
        claimed += 1;
        continue;
      }

      if (TERMINAL_KINDS.has(latestStatus)) {
        const normalized = normalizeTerminalStatus(latestStatus);
        if (normalized) {
          await setPaymentStatusIfOpen(payment.reference, normalized);
          closed += 1;
        }
      }
    } catch (err) {
      console.error(
        `[payments:reconcile] ${payment.reference} :`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { checked: rows.length, claimed, closed, skipped: false };
}
