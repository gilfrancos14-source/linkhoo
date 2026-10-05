/**
 * Source unique de vérité : « ce gérant est-il premium EN CE MOMENT ? ».
 *
 * Utilisé par le backend (qualification gérant, statistiques admin, badges des
 * réponses API) et par le frontend (`frontend/src/lib/premium.ts`, même
 * règles) pour éviter les divergences qui affichaient un premium expiré comme
 * actif.
 *
 * Règles :
 * - `is_premium` absent/faux → inactif ;
 * - `premium_expires_at` absent → actif (héritage des données : le drapeau
 *   seul engage l'abonnement, cf. `isQualifiedGerant`) ;
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

/**
 * Date de péremption déjà écrite mais dépassée : le drapeau doit être baissé
 * (expiration paresseuse, cf. `GET /api/premium/status`).
 */
export function isPremiumExpired(
  gerant: PremiumFlags | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!gerant?.is_premium || !gerant.premium_expires_at) return false;
  const expiresAt = new Date(gerant.premium_expires_at);
  if (!Number.isFinite(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= now.getTime();
}
