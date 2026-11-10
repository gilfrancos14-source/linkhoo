/**
 * Nettoyage des paiements orphelins.
 *
 * PROBLÈME :
 *   L'index unique `payments_one_open_per_target` filtre sur
 *   `status IN ('created','pending','requires_action')` mais PAS sur
 *   `expires_at IS NOT NULL`. Conséquence : si le processus crash (OOM,
 *   kill, coupure) entre l'INSERT dans `checkout.ts` et l'UPDATE qui écrit
 *   `expires_at` + `checkout_url` + `status='pending'`, la ligne reste en
 *   `created` avec `expires_at=NULL`. Elle BLOQUE DÉFINITIVEMENT la cible
 *   (même purpose + même target + même montant) : aucun nouveau checkout ne
 *   peut être créé pour ce client.
 *
 * SOLUTION :
 *   Ce job annule les paiements `created`/`pending`/`requires_action` sans
 *   `expires_at` et plus vieux que 30 min (le TTL checkout maximal chez
 *   pawaPay). Un orphelin plus vieux que ça ne peut plus être payé
 *   côté provider de toute façon, et `reconcile.ts` a déjà eu l'occasion de
 *   vérifier.
 *
 * ORDRE :
 *   Appelé APRÈS `reconcile` et `expire-unpaid` pour ne pas annuler une
 *   ligne qu'un webhook pourrait encore sauver.
 */

import { supabaseAdmin } from '../../config/supabase';

/**
 * 30 min = TTL checkout maximal (pawaPay : 30 min configurable). En dessous,
 * un orphelin peut encore être en cours de traitement chez le provider ;
 * au-dessus, plus aucune chance qu'il soit payé.
 */
export const ORPHAN_MIN_AGE_MS = 30 * 60 * 1000;

export const ORPHAN_BATCH_SIZE = 100;

interface OrphanRow {
  id: string;
  reference: string;
}

export interface CleanupOrphanResult {
  readonly checked: number;
  readonly cleaned: number;
}

/**
 * Annule les paiements orphelins (sans `expires_at` et plus vieux que 30 min).
 */
export async function cleanupOrphanPayments(
  now: Date = new Date(),
): Promise<CleanupOrphanResult> {
  const cutoff = new Date(now.getTime() - ORPHAN_MIN_AGE_MS).toISOString();
  const nowIso = now.toISOString();

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, reference')
    .in('status', ['created', 'pending', 'requires_action'])
    .is('expires_at', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(ORPHAN_BATCH_SIZE);

  if (error) throw error;

  const rows = (data as OrphanRow[] | null) ?? [];
  if (rows.length === 0) {
    return { checked: 0, cleaned: 0 };
  }

  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'canceled',
      updated_at: nowIso,
      failure_code: 'orphan_cleanup',
      failure_message:
        'Paiement orphelin (expires_at jamais écrit — probable crash entre INSERT et UPDATE).',
    })
    .in('id', rows.map((r) => r.id))
    // Double garde-fou en cas de race : re-vérifier les prédicats.
    .is('expires_at', null)
    .in('status', ['created', 'pending', 'requires_action']);

  if (updateError) throw updateError;

  console.warn('[payments:cleanup] paiements orphelins annulés', {
    count: rows.length,
    references: rows.map((r) => r.reference),
  });

  return { checked: rows.length, cleaned: rows.length };
}