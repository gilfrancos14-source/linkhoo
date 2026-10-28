interface GerantQualificationFields {
  is_verified: boolean | null;
}

/**
 * Un gérant peut gérer ses réservations dès qu'il est vérifié.
 *
 * Le premium ne conditionne plus l'accès aux réservations : il reste réservé
 * à la visibilité (badge, mise en avant dans les résultats) et ne doit donc
 * pas être interrogé ici.
 */
export function isQualifiedGerant(gerant: GerantQualificationFields | null | undefined): boolean {
  return Boolean(gerant?.is_verified);
}
