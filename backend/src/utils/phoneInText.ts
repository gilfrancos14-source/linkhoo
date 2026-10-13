/**
 * Détection de numéros de téléphone dans un texte public (description,
 * conditions d'une annonce). Les coordonnées restent dans le profil du
 * gérant : le contact passe par la messagerie de la plateforme.
 *
 * Faux positifs assumés et écartés :
 *  - dates « 12-03-2026 », « 12.03.26 » : ignorées avant le test ;
 *  - prix courants (6 chiffres max : « 150 000 FCFA ») : le seuil est à
 *    8 chiffres, un loyer mensuel à 8 chiffres est hors norme.
 */

const DATE_LIKE_RE = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g;
const PHONE_DIGITS_RE = /(?:\+|00)\d[\d\s.()-]{4,}\d|\d(?:[\s.()-]*\d){7,}/;
const PHONE_DIGITS_ALL_RE = new RegExp(PHONE_DIGITS_RE, 'g');
const PHONE_KEYWORD_RE = /\b(?:t[ée]l[ée]phone|tel:|whatsapp|appelez|appeler)\b/i;
const PHONE_KEYWORD_ALL_RE = new RegExp(PHONE_KEYWORD_RE, 'gi');

export const PHONE_IN_TEXT_ERROR =
  'Les numéros de téléphone ne sont pas autorisés : les clients vous contactent via la messagerie de la plateforme.';

const normalize = (value: string) => value.replace(DATE_LIKE_RE, ' ');

export function containsPhoneNumber(value: string): boolean {
  const text = normalize(value);
  return PHONE_DIGITS_RE.test(text) || PHONE_KEYWORD_RE.test(text);
}

/** Retire les coordonnées détectées (nettoyage des annonces existantes). */
export function stripPhoneFromText(value: string): { text: string; changed: boolean } {
  const text = normalize(value)
    .replace(PHONE_DIGITS_ALL_RE, ' ')
    .replace(PHONE_KEYWORD_ALL_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text, changed: text !== value.trim() };
}
