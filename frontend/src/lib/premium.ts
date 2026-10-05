/**
 * Source unique de vérité côté client : « ce gérant est-il premium EN CE
 * MOMENT ? ». Miroir exact de `backend/src/utils/premium.ts` (mêmes règles) :
 * un badge ne doit jamais afficher un abonnement expiré comme actif.
 *
 * Règles :
 * - `is_premium` absent/faux → inactif ;
 * - `premium_expires_at` absent → actif (le drapeau seul engage l'abonnement) ;
 * - date illisible ou passée → inactif.
 */
export interface PremiumFlags {
  is_premium?: boolean | null;
  premium_expires_at?: string | null;
}

export function isPremiumActive(
  gerant: PremiumFlags | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!gerant?.is_premium) return false;
  const raw = gerant.premium_expires_at;
  if (raw === null || raw === undefined) return true;
  const expiresAt = new Date(raw);
  if (!Number.isFinite(expiresAt.getTime())) return false;
  return expiresAt.getTime() > now.getTime();
}
