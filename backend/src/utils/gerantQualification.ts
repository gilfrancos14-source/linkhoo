import { isPremiumActive, type PremiumFlags } from './premium';

interface GerantQualificationFields extends PremiumFlags {
  is_verified: boolean | null;
}

/**
 * Un gérant peut gérer ses réservations s'il est vérifié ET premium.
 * La partie premium est déléguée à `isPremiumActive` : la même règle doit
 * piloter l'accès, les badges et les statistiques (sinon un abonnement expiré
 * reste affiché « actif » quelque part).
 */
export function isQualifiedGerant(gerant: GerantQualificationFields | null | undefined): boolean {
  if (!gerant || !gerant.is_verified) return false;
  return isPremiumActive(gerant);
}
