/**
 * Validation d'email minimale, partagée par les routes.
 *
 * Volontairement permissive : on ne veut pas rejeter une adresse valide sur une
 * subtilité de la RFC 5322. Le but est d'écarter les saisies manifestement
 * invalides avant d'appeler un prestataire de paiement.
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
