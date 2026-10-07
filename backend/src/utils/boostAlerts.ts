// M4 de REVUE_BOOST.md — « paiement encaissé, campagne absente ».
//
// Cas atteignables : tentative supersédée (> 10 min) puis paiement terminé
// sur l'onglet restant, ou chambre supprimée pendant le paiement (cascade
// ON DELETE). La RPC activate_boost_checked annule alors le claim : aucun
// budget n'est crédité, mais FedaPay a bel et bien débité le gérant.
//
// Jusqu'ici : un simple console.warn. Désormais :
//  - une notification admin (`boost_paid_without_campaign`) traçable et
//    marquable lue, id déterministe → jamais de doublon webhook/confirm ;
//  - le ledger premium_transactions reste la preuve (status 'approved',
//    activated_at NULL) — c'est sur cette ligne que le support rembourse.
// Une erreur d'alerte ne casse JAMAIS le paiement : on loggue et on sort.

import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from './realtime';

export interface PaidWithoutCampaignInput {
  clerkUserId: string;
  market: string;
  transactionId: number | string;
  amount: number;
  /** D'où vient la détection (webhook, confirm, rattrapage) — journal. */
  source: string;
}

/** Id déterministe : webhook + /confirm sur la même transaction = une seule ligne. */
function incidentId(transactionId: number | string): string {
  return `boost-paid-${transactionId}`;
}

export async function flagPaidWithoutCampaign(input: PaidWithoutCampaignInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      id: incidentId(input.transactionId),
      type: 'boost_paid_without_campaign',
      gerant_id: input.clerkUserId,
      message:
        `Paiement boost de ${input.amount} XOF reçu (transaction FedaPay ` +
        `${input.transactionId}, marché ${input.market}) sans campagne correspondante : ` +
        'remboursement à traiter.',
    });
    if (error && error.code !== '23505') throw error; // 23505 = déjà alerté

    await publishNotificationChanged('admin', 'gerant');
    console.warn(
      `[boosts] ${input.source}: transaction ${input.transactionId} encaissée sans campagne ` +
        `(gérant ${input.clerkUserId}, ${input.amount} XOF) — notification admin créée.`,
    );
  } catch (err) {
    console.warn(
      '[boosts] alerte paid_without_campaign impossible :',
      (err as Error)?.message || err,
    );
  }
}
