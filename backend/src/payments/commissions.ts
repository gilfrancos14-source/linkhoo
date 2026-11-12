/**
 * Grille de commission de la plateforme.
 *
 * Décision commerciale (12/11/2026) : la commission prélevée sur le séjour
 * dépend du statut du gérant, pas du marché.
 *
 *   premium ET vérifié  →  5 %
 *   vérifié seul        → 10 %
 *   premium seul        → 10 %  (un seul des deux statuts)
 *   ni l'un ni l'autre  → 15 %
 *
 * La commission s'applique sur le montant BRUT du séjour ; le gérant reçoit
 * le net. Un séjour remboursé en partie retire le remboursement du net
 * (cf. `computePayoutAmounts`).
 *
 * Le « premium » ne compte que s'il est actif (abonnement en cours) : un
 * premium expiré retombe dans la case « premium seul » ou « sans statut ».
 */

import { isPremiumActive } from '../utils/premium';

export type CommissionTier = 'premium_verified' | 'verified' | 'premium' | 'none';

export const COMMISSION_PERCENT_BY_TIER: Record<CommissionTier, number> = {
  premium_verified: 5,
  verified: 10,
  premium: 10,
  none: 15,
};

export interface GerantCommissionFlags {
  is_verified?: boolean | null;
  is_premium?: boolean | null;
  premium_expires_at?: string | null;
}

/** Détermine la case de commission d'un gérant. */
export function commissionTierFor(
  gerant: GerantCommissionFlags | null | undefined,
  now: Date = new Date(),
): CommissionTier {
  const verified = gerant?.is_verified === true;
  const premium = isPremiumActive(gerant ?? null, now);
  if (premium && verified) return 'premium_verified';
  if (verified) return 'verified';
  if (premium) return 'premium';
  return 'none';
}

/** Pourcentage de commission applicable à un gérant. */
export function commissionPercentFor(
  gerant: GerantCommissionFlags | null | undefined,
  now: Date = new Date(),
): number {
  return COMMISSION_PERCENT_BY_TIER[commissionTierFor(gerant, now)];
}

/** Libellé lisible (notifications, back-office). */
export const COMMISSION_TIER_LABELS: Record<CommissionTier, string> = {
  premium_verified: 'Premium et vérifié',
  verified: 'Vérifié',
  premium: 'Premium',
  none: 'Non vérifié',
};
