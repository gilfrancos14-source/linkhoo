interface GerantQualificationFields {
  is_verified: boolean | null;
  is_premium: boolean | null;
  premium_expires_at?: string | null;
}

export function isQualifiedGerant(gerant: GerantQualificationFields | null | undefined): boolean {
  if (!gerant || !gerant.is_verified || !gerant.is_premium) return false;
  if (gerant.premium_expires_at && new Date(gerant.premium_expires_at) <= new Date()) return false;
  return true;
}
