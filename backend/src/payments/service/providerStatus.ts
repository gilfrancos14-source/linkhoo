/**
 * Lecture de l'état réel d'un paiement chez pawaPay.
 */

import { getPawapayConfig } from '../pawapay/config';
import { PawapayClient } from '../pawapay/client';
import { mapPawapayStatus } from '../pawapay/mapping';

export interface ProviderPayment {
  readonly id: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
}

export interface ProviderPaymentLookup {
  readonly payment: ProviderPayment | null;
  readonly latestStatus: string;
}

export function providerNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null;
}

export function providerCurrency(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
}

/**
 * Relit un checkout pawaPay et retourne le dépôt COMPLETED s'il existe.
 *
 * Les erreurs TECHNIQUES (DB down, config absente, réseau) remontent au
 * caller : les convertir en `failed` afficherait « paiement échoué » alors que
 * le paiement est peut-être en cours, poussant l'utilisateur à recommencer
 * (double débit potentiel).
 */
export async function lookupProviderPayment(
  reference: string,
): Promise<ProviderPaymentLookup> {
  const { supabaseAdmin } = await import('../../config/supabase');

  const { data: row, error: dbError } = await supabaseAdmin
    .from('payments')
    .select('pawapay_checkout_id')
    .eq('reference', reference)
    .maybeSingle();
  if (dbError) throw dbError;

  const checkoutId = row?.pawapay_checkout_id as string | undefined;
  if (!checkoutId) return { payment: null, latestStatus: 'pending' };

  const client = new PawapayClient(getPawapayConfig());
  const lookup = await client.getCheckoutStatus(checkoutId);

  if (lookup.status !== 'FOUND') {
    return { payment: null, latestStatus: 'pending' };
  }

  const checkout = lookup.data;
  const mapped = mapPawapayStatus(checkout.status);

  if (checkout.status === 'COMPLETED') {
    // Comme dans `webhooks.ts` : chercher le dépôt COMPLETED dans l'historique
    // (le dernier `checkout.deposit` peut être une tentative FAILED).
    const deposit =
      checkout.depositsHistory?.find((entry) => entry.status === 'COMPLETED') ??
      (checkout.deposit?.status === 'COMPLETED' ? checkout.deposit : undefined);

    if (!deposit?.depositId) {
      // Pas de depositId exploitable : ne pas fabriquer un faux identifiant
      // (sinon remboursement impossible). La réconciliation repassera.
      return { payment: null, latestStatus: 'succeeded' };
    }

    return {
      payment: {
        id: deposit.depositId,
        amount: deposit.amount
          ? providerNumber(Number(deposit.amount))
          : providerNumber(Number(checkout.amounts?.[0]?.amount)),
        currency: deposit.currency ?? checkout.amounts?.[0]?.currency ?? null,
      },
      latestStatus: 'succeeded',
    };
  }

  return { payment: null, latestStatus: mapped };
}
