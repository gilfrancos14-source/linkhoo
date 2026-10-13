export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Miroir de backend/src/utils/phoneInText.ts : le serveur reste le filet de
// sécurité, ceci sert à afficher l'erreur avant l'envoi.
const DATE_LIKE_RE = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g;
const PHONE_DIGITS_RE = /(?:\+|00)\d[\d\s.()-]{4,}\d|\d(?:[\s.()-]*\d){7,}/;
const PHONE_KEYWORD_RE = /\b(?:t[ée]l[ée]phone|tel:|whatsapp|appelez|appeler)\b/i;

export const PHONE_IN_TEXT_ERROR =
  'Les numéros de téléphone ne sont pas autorisés : les clients vous contactent via la messagerie de la plateforme.';

export function containsPhoneNumber(value: string): boolean {
  const text = value.replace(DATE_LIKE_RE, ' ');
  return PHONE_DIGITS_RE.test(text) || PHONE_KEYWORD_RE.test(text);
}
