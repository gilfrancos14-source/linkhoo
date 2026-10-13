// Constantes métier de la fonctionnalité Boost — source unique de vérité
// côté serveur. Le front les reçoit via GET /api/boosts/config (jamais de
// montant calculé côté client).
//
// Tarifs fixés au lancement (FCFA, devise XOF) :
//   - mode 'cpc' : 50 F par clic unique (1× par visiteur et campagne / 24 h) ;
//   - mode 'cpi' : 5 F par impression (1× par visiteur et campagne / 10 min) ;
//   - budget de campagne : libre (saisi par le gérant), entier, borné à
//     [3 000 ; 100 000] F — ni les forfaits d'origine, ni aucun montant
//     hors intervalle ne sont acceptés à la création ni au paiement.

export const BOOST_CURRENCY = 'XOF';
export const BOOST_PRICE_CPC = 50;
export const BOOST_PRICE_CPI = 5;

// Budget de campagne : libre (saisi par le gérant), entier, multiple du pas
// de facturation (50 F par clic ou 5 F par impression) pour qu'aucun
// reliquat ne soit perdu à l'épuisement.
//
// Deux couples de bornes, volontairement distincts :
//   - CRÉATION (UI + /initiate) : BOOST_MIN_BUDGET / BOOST_MAX_BUDGET —
//     seules celles-ci évoluent avec l'offre produit ;
//   - ACCEPTATION d'un paiement (webhook, /confirm, rattrapage) :
//     BOOST_ACCEPT_MIN_BUDGET / BOOST_ACCEPT_MAX_BUDGET — NE JAMAIS les
//     resserrer : une transaction en cours ou une campagne déjà payée reste
//     honorée, sinon elle est refusée et déclenche une fausse alerte admin.
export const BOOST_MIN_BUDGET = 3000;
export const BOOST_MAX_BUDGET = 100000;
export const BOOST_ACCEPT_MIN_BUDGET = 3000;
export const BOOST_ACCEPT_MAX_BUDGET = 100000;

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

/**
 * Montant de paiement accepté pour une campagne : entier strictement dans
 * [BOOST_ACCEPT_MIN_BUDGET ; BOOST_ACCEPT_MAX_BUDGET]. Utilisé aux trois
 * chemins de confirmation (webhook, /confirm, rattrapage) — un montant hors
 * intervalle n'active rien et déclenche l'alerte support. Porte sur la
 * borne d'ACCEPTATION, jamais sur la borne de création (voir en-tête).
 */
export function isValidBoostBudget(amount: number): boolean {
  return Number.isInteger(amount) && amount >= BOOST_ACCEPT_MIN_BUDGET && amount <= BOOST_ACCEPT_MAX_BUDGET;
}

/**
 * Pas de saisie d'un budget : le montant doit être un multiple du prix de
 * l'unité facturée par le mode choisi, sinon la campagne s'épuise en
 * laissant un reliquat non dépensable (50 F en cpc, 5 F en cpi).
 */
export function boostBudgetStep(mode: BoostMode): number {
  return mode === 'cpc' ? BOOST_PRICE_CPC : BOOST_PRICE_CPI;
}
