/**
 * Application métier d'un événement webhook pawaPay.
 *
 * Le webhook est le chemin NOMINAL : il arrive avant ou après le retour
 * navigateur, parfois plusieurs fois, parfois dans le désordre. Toutes les
 * transitions sont donc idempotentes et ne rétrogradent jamais un paiement
 * réussi.
 */

import { supabaseAdmin } from '../../config/supabase';
import { premiumDaysFromMetadata } from '../premiumPlans';
import { processPawapayWebhook } from '../pawapay/webhooks';
import { logger } from '../../lib/logger';

export interface ApplyEventResult {
  readonly handled: boolean;
  readonly reason?: string;
}

/** Statuts d'un paiement encore ouvert (non terminal). */
export const OPEN_PAYMENT_STATUSES = ['created', 'pending', 'requires_action'] as const;

export type OpenPaymentStatus = (typeof OPEN_PAYMENT_STATUSES)[number];

export type NonTerminalStatus = 'pending' | 'requires_action' | 'failed' | 'canceled' | 'expired';

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

export async function claimSucceededPayment(input: ClaimSucceededInput): Promise<void> {
  if (input.purpose === 'premium') {
    const { data: row, error: readError } = await supabaseAdmin
      .from('payments')
      .select('metadata')
      .eq('reference', input.reference)
      .maybeSingle();
    if (readError) throw readError;
    const metadata = (row as { metadata?: Record<string, unknown> | null } | null)?.metadata;

    const { error } = await supabaseAdmin.rpc('payment_claim_premium', {
      p_reference: input.reference,
      p_provider_payment_id: input.providerPaymentId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_days: premiumDaysFromMetadata(metadata),
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
 * Applique un événement webhook pawaPay.
 *
 * IMPORTANT — gestion d'erreur :
 *   - Les erreurs MÉTIER sont absorbées par `processPawapayWebhook` qui
 *     retourne un résultat.
 *   - Les erreurs TECHNIQUES (DB down, timeout, config absente) remontent.
 *     On les PROPAGE pour que le route handler renvoie 500 et déclenche un
 *     retry côté pawaPay. Sans cela, pawaPay considère le webhook livré et
 *     ne retentera jamais → paiement bloqué en `pending`.
 */
export async function applyPawapayEvent(body: unknown): Promise<ApplyEventResult> {
  try {
    const result = await processPawapayWebhook(body);
    return { handled: result.handled, reason: result.reason };
  } catch (error) {
    logger.error(`Erreur lors du traitement de l'événement pawaPay`, { error });
    // Propager : le route handler DOIT mapper cette exception en 500 pour
    // déclencher un retry pawaPay.
    throw error;
  }
}
