/**
 * Formatage des dates partagé par toutes les vues.
 *
 * Une seule règle d'affichage (locale fr-FR) pour éviter que chaque écran
 * reformate les dates à sa façon. Les valeurs absentes ou invalides renvoient
 * une chaîne vide : c'est au site d'appel de fournir son repli (« — », …).
 */

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « 05/10/2026 » — format court par défaut. */
export function formatDate(value: DateInput): string {
  return toDate(value)?.toLocaleDateString('fr-FR') ?? '';
}

/** « 5 octobre 2026 » — date longue (profil, premium, vérification). */
export function formatDateLong(value: DateInput): string {
  return (
    toDate(value)?.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) ?? ''
  );
}
