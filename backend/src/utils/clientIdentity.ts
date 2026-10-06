/**
 * Identité du client qui réserve : nom, email, téléphone.
 *
 * Règle produit : cette identité n'est révélée qu'à la plateforme (routes
 * admin) et à un gérant **vérifié + premium actif** — `isQualifiedGerantUser`.
 * Ailleurs, en particulier le fil de notifications d'un gérant non qualifié
 * (la seule route de ce profil qui renvoie des données de réservation), elle
 * est masquée : celui-ci voit une demande de dates, pas une personne.
 *
 * `message` n'est masqué que sur les notifications de réservation : c'était le
 * texte libre du client (retiré du produit, colonne supprimée par la migration
 * 0011), qui pouvait contenir un nom ou un numéro — les notifications de
 * vérification, elles, ne portent aucune identité et restent lisibles.
 */
export function maskClientIdentity<T extends Record<string, unknown>>(row: T): T {
  const masked: Record<string, unknown> = { ...row };
  masked.client_name = null;
  masked.client_email = null;
  masked.client_phone = null;
  if (row.type === 'reservation') masked.message = null;
  return masked as T;
}
