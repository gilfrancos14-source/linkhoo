/**
 * Réconciliation des paiements restés ouverts.
 *
 * Le webhook est le chemin nominal, mais il peut être perdu (endpoint
 * indisponible, événement non souscrit dans le dashboard). Ce job interroge
 * Hub2 pour les paiements encore `created`/`pending`/`requires_action` :
 *
 *   - succès confirmé → même RPC atomique que le webhook (`claimSucceededPayment`) ;
 *   - échec / expiration confirmée → statut terminal, sans rétrograder un succès ;
 *   - toujours en attente → aucune écriture, on repassera au prochain tour.
 *
 * Aucun montant n'est décidé ici : la ligne `payments` reste la source de
 * vérité et la RPC revérifie montant + devise.
 */

import { supabaseAdmin } from '../../config/supabase';
import { getHub2Config, Hub2ConfigError } from '../config';
import { isHub2Provider } from '../provider';
import type { Hub2Currency } from '../types';
import {
  claimSucceededPayment,
  OPEN_PAYMENT_STATUSES,
  setPaymentStatusIfOpen,
} from '../service/applyEvent';
import { lookupProviderPayment } from '../service/providerStatus';

/** On laisse au webhook le temps d'arriver avant d'interroger Hub2. */
export const RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;

export const RECONCILE_BATCH_SIZE = 50;

interface PendingPaymentRow {
  reference: string;
  purpose: string;
  amount: number;
  currency: Hub2Currency;
  provider_payment_link_id: string | null;
}

export interface ReconcileResult {
  readonly checked: number;
  readonly claimed: number;
  readonly closed: number;
  readonly skipped: boolean;
}

const TERMINAL_KINDS = new Set(['failed', 'canceled', 'expired']);

/**
 * Interroge Hub2 pour chaque paiement ouvert un peu ancien.
 *
 * Ne lève pas pour un incident prestataire : un lot ne doit pas être perdu
 * parce qu'un appel réseau a échoué. Les erreurs sont journalisées et la ligne
 * reste ouverte pour le tour suivant.
 */
export async function reconcilePendingPayments(
  now: Date = new Date(),
): Promise<ReconcileResult> {
  if (!isHub2Provider()) {
    return { checked: 0, claimed: 0, closed: 0, skipped: true };
  }

  let config;
  try {
    config = getHub2Config();
  } catch (error) {
    if (error instanceof Hub2ConfigError) {
      console.warn(`[payments:reconcile] Hub2 non configuré : ${error.code}`);
      return { checked: 0, claimed: 0, closed: 0, skipped: true };
    }
    throw error;
  }

  const cutoff = new Date(now.getTime() - RECONCILE_MIN_AGE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('reference, purpose, amount, currency, provider_payment_link_id')
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
        config,
        payment.reference,
        payment.provider_payment_link_id,
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
        await setPaymentStatusIfOpen(
          payment.reference,
          latestStatus as 'failed' | 'canceled' | 'expired',
        );
        closed += 1;
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
