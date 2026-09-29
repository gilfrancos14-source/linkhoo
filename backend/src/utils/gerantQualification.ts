interface GerantQualificationFields {
  is_verified: boolean | null;
  is_premium: boolean | null;
  premium_expires_at?: string | null;
}

export function isQualifiedGerant(gerant: GerantQualificationFields | null | undefined): boolean {
  if (!gerant || !gerant.is_verified || !gerant.is_premium) return false;
  if (gerant.premium_expires_at !== null && gerant.premium_expires_at !== undefined) {
    const expiresAt = new Date(gerant.premium_expires_at);
    // Date illisible (corruption, format fantaisiste) : on refuse plutôt que
    // de laisser l'accès premium ouvert, NaN <= now étant toujours faux.
    if (!Number.isFinite(expiresAt.getTime())) return false;
    if (expiresAt <= new Date()) return false;
  }
  return true;
}
