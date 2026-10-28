/**
 * Application métier d'un événement webhook Hub2.
 *
 * Le webhook est le chemin NOMINAL : il arrive avant ou après le retour
 * navigateur, parfois plusieurs fois, parfois dans le désordre. Toutes les
 * transitions sont donc idempotentes et ne rétrogradent jamais un paiement
 * réussi :
 *
 *   - `payment_intent.succeeded` → RPC `payment_claim_premium` (premium),
 *     `payment_claim_booking` (réservation) ou `payment_claim_succeeded` ;
 *   - `payment_intent.payment_failed` / `canceled` / `expired` → statut terminal ;
 *   - `processing` / `action_required` → statut intermédiaire ;
 *   - `refund.*` / `payment_refund.*` → statut du remboursement (et
 *     compensation si Hub2 refuse définitivement) ;
 *   - `transfer.*` → statut du reversement gérant (phase 4).
 */

import { supabaseAdmin } from '../../config/supabase';
import { eventKind } from '../hub2/mapping';
import {
  extractProviderId,
  extractPurchaseReference,
  extractRefundId,
  extractTransferId,
  type Hub2Event,
} from '../hub2/webhooks';
import { applyTransferEvent } from './payout';
import { PREMIUM_DURATION_DAYS } from './premium';
import { applyRefundEvent } from './refund';

export interface ApplyEventResult {
  readonly handled: boolean;
  /** Motif stocké dans `payment_events.processing_error` quand non traité. */
  readonly reason?: string;
}

interface PaymentForEvent {
  reference: string;
  purpose: string;
  amount: number;
  currency: string;
  status: string;
}

async function fetchPayment(reference: string): Promise<PaymentForEvent | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('reference, purpose, amount, currency, status')
    .eq('reference', reference)
    .maybeSingle();

  if (error) throw error;
  return (data as PaymentForEvent | null) ?? null;
}

/** Statuts d'un paiement encore ouvert (non terminal). */
export const OPEN_PAYMENT_STATUSES = ['created', 'pending', 'requires_action'] as const;

export type OpenPaymentStatus = (typeof OPEN_PAYMENT_STATUSES)[number];

/** Statut non terminal applicable à un paiement encore ouvert. */
export type NonTerminalStatus = 'pending' | 'requires_action' | 'failed' | 'canceled' | 'expired';

/**
 * Met à jour un statut non terminal sans écraser un succès.
 *
 * `in('status', …)` joue le rôle de garde : si le webhook `failed` arrive
 * après `succeeded`, aucune ligne ne correspond et rien ne change. Le webhook
 * et la réconciliation partagent cette fonction.
 */
export async function setPaymentStatusIfOpen(
  reference: string,
  status: NonTerminalStatus,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('reference', reference)
    .in('status', [...OPEN_PAYMENT_STATUSES]);

  if (error) throw error;
}

export interface ClaimSucceededInput {
  readonly reference: string;
  readonly purpose: string;
  readonly providerPaymentId: string | null;
  readonly amount: number;
  readonly currency: string;
}

/**
 * Active la contrepartie d'un paiement réellement encaissé.
 *
 * Partagé par le webhook et la réconciliation : les deux chemins passent par
 * la même RPC atomique (`fulfilled_at` sert de témoin), donc un second appel
 * reçoit `already_claimed = true` et ne crédite rien deux fois.
 */
export async function claimSucceededPayment(input: ClaimSucceededInput): Promise<void> {
  if (input.purpose === 'premium') {
    const { error } = await supabaseAdmin.rpc('payment_claim_premium', {
      p_reference: input.reference,
      p_provider_payment_id: input.providerPaymentId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_days: PREMIUM_DURATION_DAYS,
    });
    if (error) throw error;
    return;
  }

  if (input.purpose === 'booking') {
    const { error } = await supabaseAdmin.rpc('payment_claim_booking', {
      p_reference: input.reference,
      p_provider_payment_id: input.providerPaymentId,
      p_amount: input.amount,
      p_currency: input.currency,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.rpc('payment_claim_succeeded', {
    p_reference: input.reference,
    p_provider_payment_id: input.providerPaymentId,
    p_amount: input.amount,
    p_currency: input.currency,
  });
  if (error) throw error;
}

/**
 * Montant et devise annoncés par Hub2, quand l'événement les porte.
 *
 * Ils sont revérifiés par la RPC : un webhook dont le montant ne correspond
 * pas au paiement attendu est refusé plutôt que d'activer un produit. Sans
 * ces champs (certains événements ne les exposent pas), on retombe sur la
 * ligne `payments`, qui reste la référence serveur.
 */
function providerAmount(event: Hub2Event): { amount: number; currency: string } | null {
  const amount = event.data.amount;
  const currency = event.data.currency;
  if (
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount > 0 &&
    typeof currency === 'string' &&
    /^[A-Z]{3}$/.test(currency)
  ) {
    return { amount: Math.trunc(amount), currency };
  }
  return null;
}

export async function applyHub2Event(event: Hub2Event): Promise<ApplyEventResult> {
  const kind = eventKind(event.type);

  // Les remboursements ont leur propre cycle de vie : ils ne portent pas
  // toujours `purchaseReference` et se rattachent par `provider_refund_id`.
  if (kind.startsWith('refund_')) {
    return applyRefundEvent(event, kind, extractRefundId(event));
  }

  // Les reversements se rattachent par `provider_transfer_id`, pas par une
  // référence de paiement : ils ont leur propre cycle de vie.
  if (kind.startsWith('transfer_')) {
    return applyTransferEvent(event, kind, extractTransferId(event));
  }

  if (!kind.startsWith('payment_')) {
    return { handled: false, reason: 'unsupported_event' };
  }

  const reference = extractPurchaseReference(event);
  if (!reference) {
    return { handled: false, reason: 'missing_reference' };
  }

  const payment = await fetchPayment(reference);
  if (!payment) {
    // Peut arriver pour un paiement d'un autre marchand partageant le même
    // endpoint, ou pour un événement très ancien purgé : on trace sans
    // faire échouer la livraison.
    return { handled: false, reason: 'payment_not_found' };
  }

  switch (kind) {
    case 'payment_succeeded': {
      const providerPaymentId = extractProviderId(event);
      const announced = providerAmount(event);
      await claimSucceededPayment({
        reference: payment.reference,
        purpose: payment.purpose,
        providerPaymentId,
        amount: announced?.amount ?? payment.amount,
        currency: announced?.currency ?? payment.currency,
      });
      return { handled: true };
    }

    case 'payment_failed':
      await setPaymentStatusIfOpen(reference, 'failed');
      return { handled: true };

    case 'payment_canceled':
      await setPaymentStatusIfOpen(reference, 'canceled');
      return { handled: true };

    case 'payment_expired':
      await setPaymentStatusIfOpen(reference, 'expired');
      return { handled: true };

    case 'payment_processing':
      await setPaymentStatusIfOpen(reference, 'pending');
      return { handled: true };

    case 'payment_requires_action':
      await setPaymentStatusIfOpen(reference, 'requires_action');
      return { handled: true };

    case 'payment_created':
      // La ligne existe déjà : aucun changement d'état nécessaire.
      return { handled: true };

    default:
      return { handled: false, reason: 'unsupported_event' };
  }
}
