// Helpers partagés du ledger premium_transactions : le webhook FedaPay
// unique (/api/premium/webhook) crédite à la fois les abonnements premium
// et les campagnes boost — les deux vivent dans la même table d'audit,
// distinguées par la colonne `type`.
//
// Extrait de routes/premium.ts pour que routes/boosts.ts réutilise
// l'upsert sans dépendre d'un routeur (ni de cycles d'import).

import { supabaseAdmin } from '../config/supabase';
import type { PremiumTxStatus } from '../smoke/fedapayRiskTests.helpers';

export const TX_TYPES = ['premium', 'verification', 'boost'] as const;
export type TxType = (typeof TX_TYPES)[number];

/**
 * Ramène le type de transaction à une valeur autorisée par le CHECK
 * (premium_transactions.type) ou renvoie null si la valeur est inconnue.
 * 'premium_subscription' est l'ancien libellé utilisé par les transactions
 * créées avant l'ajout de la colonne `type`.
 */
export function normalizeTxType(value: unknown): TxType | null {
  if (value === 'premium_subscription') return 'premium';
  if (typeof value === 'string' && (TX_TYPES as readonly string[]).includes(value)) {
    return value as TxType;
  }
  return null;
}

export async function upsertPremiumTransaction(input: {
  fedapayTransactionId: number | string;
  clerkUserId: string;
  market: string;
  amount: number;
  status: PremiumTxStatus;
  customerEmail?: string | null;
  rawEvent?: unknown;
  type?: TxType;
  /** m7 : n'écrit que si la ligne est encore 'pending' (rejeu webhook tardif). */
  onlyIfPending?: boolean;
}): Promise<{ id: string; status: PremiumTxStatus; activated: boolean }> {
  const txId = Number(input.fedapayTransactionId);
  if (!Number.isFinite(txId) || txId <= 0) {
    throw new Error('fedapay_transaction_id invalide');
  }

  if (input.onlyIfPending) {
    const { data: existing, error: readError } = await supabaseAdmin
      .from('premium_transactions')
      .select('id, status, activated_at')
      .eq('fedapay_transaction_id', txId)
      .maybeSingle();
    if (readError) throw readError;
    if (existing && existing.status !== 'pending') {
      // Ligne déjà tranchée (approved/declined/canceled) : on la renvoie
      // telle quelle, sans régression de statut.
      return {
        id: existing.id,
        status: existing.status as PremiumTxStatus,
        activated: !!existing.activated_at,
      };
    }
  }

  const { data, error } = await supabaseAdmin
    .from('premium_transactions')
    .upsert(
      {
        fedapay_transaction_id: txId,
        clerk_user_id: input.clerkUserId,
        market: input.market,
        amount: input.amount,
        currency: 'XOF',
        status: input.status,
        customer_email: input.customerEmail ?? null,
        raw_event: input.rawEvent ?? null,
        type: input.type ?? 'premium',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fedapay_transaction_id' }
    )
    .select('id, status, activated_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Insertion premium_transactions échouée');

  return {
    id: data.id,
    status: data.status as PremiumTxStatus,
    activated: !!data.activated_at,
  };
}

/**
 * Claim atomique de la transaction d'une campagne boost (RPC
 * activate_boost_checked) : webhook et page de retour arrivent souvent
 * ensemble, un seul crédite la campagne.
 *
 * BOOST_NOT_FOUND (transaction sans ligne boosts correspondante — campagne
 * remplacée ou annulée) est renvoyé tel quel : la RPC a annulé le claim,
 * aucun budget n'est crédité à tort.
 */
export async function activateBoostForTransaction(
  premiumTransactionId: string
): Promise<{ alreadyActivated: boolean; boostId: string | null }> {
  const { data, error } = await supabaseAdmin.rpc('activate_boost_checked', {
    p_transaction_id: premiumTransactionId,
  });
  if (error) {
    if (error.message?.includes('BOOST_NOT_FOUND')) {
      return { alreadyActivated: false, boostId: null };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Activation boost échouée (réponse vide)');

  return {
    alreadyActivated: Boolean(row.already_activated),
    boostId: row.boost_id ?? null,
  };
}
