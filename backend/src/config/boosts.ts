// Constantes métier de la fonctionnalité Boost — source unique de vérité
// côté serveur. Le front les reçoit via GET /api/boosts/config (jamais de
// montant calculé côté client).
//
// Tarifs et budgets fixés au lancement (FCFA, devise XOF) :
//   - mode 'cpc' : 50 F par clic unique (1× par visiteur et campagne / 24 h) ;
//   - mode 'cpi' : 5 F par impression (1× par visiteur et campagne / 10 min) ;
//   - budgets proposés au gérant : 1 000 / 3 000 / 5 000 F.

export const BOOST_CURRENCY = 'XOF';
export const BOOST_PRICE_CPC = 50;
export const BOOST_PRICE_CPI = 5;
export const BOOST_BUDGETS = [1000, 3000, 5000] as const;
export type BoostBudget = (typeof BOOST_BUDGETS)[number];

export type BoostMode = 'cpc' | 'cpi';
export type BoostKind = 'click' | 'impression';

// Fenêtre de dates : max 90 jours entre début et fin (décision produit).
export const BOOST_MAX_DURATION_DAYS = 90;
// Défauts de l'écran de création : aujourd'hui → +30 jours.
export const BOOST_DEFAULT_DURATION_DAYS = 30;

// Tolérance sur une date de début « passée » : autorise aujourd'hui dans
// n'importe quel fuseau (le gérant en CI publie depuis UTC).
export const BOOST_START_GRACE_MS = 12 * 60 * 60 * 1000;

// Une tentative de paiement plus vieille que ce délai est considérée
// abandonnée : la tentative suivante la remplace (index UNIQUE partiel sur
// pending/active interdit d'en avoir deux pour la même chambre).
export const BOOST_PENDING_SUPERSEDE_MS = 10 * 60 * 1000;

/**
 * Montant débité pour un événement, selon le mode de la campagne.
 * Le client n'envoie JAMAIS de montant : c'est ce calcul qui alimente
 * p_amount de la RPC charge_boost.
 */
export function boostChargeAmount(mode: BoostMode, kind: BoostKind): number {
  if (mode === 'cpc' && kind === 'click') return BOOST_PRICE_CPC;
  if (mode === 'cpi' && kind === 'impression') return BOOST_PRICE_CPI;
  return 0;
}
