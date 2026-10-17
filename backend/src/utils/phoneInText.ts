/**
 * Détection de coordonnées hors plateforme dans un texte public : numéros de
 * téléphone, mais aussi email, URL et pseudos `@handle`. Le contact doit passer
 * par la messagerie de la plateforme.
 *
 * Architecture en trois couches, toutes pures et déterministes (chemin chaud de
 * validation : exécution synchrone, sans I/O, sans modèle) :
 *
 *   1. `normalize`   — une seule passe : caractères invisibles, Unicode (NFKC),
 *                      repli des chiffres non-ASCII, minuscules, accents ôtés.
 *   2. détecteurs    — runs de chiffres (bande 10-12 « certaine », 8-9 avec
 *                      indice, +/00 + indicatif jusqu'à 13), nombres écrits en
 *                      lettres, repli leet contrôlé, mots-clés, email/URL/handle.
 *   3. `detect…`     — décision structurée, exposée aux appelants.
 *
 * `containsPhoneNumber` / `stripPhoneFromText` restent la surface publique
 * historique (signatures inchangées) : les appelants n'ont rien à changer.
 */

export const PHONE_IN_TEXT_ERROR =
  'Les numéros de téléphone et autres coordonnées (email, réseaux) ne sont pas autorisés : les clients vous contactent via la messagerie de la plateforme.';

export interface ContactConfig {
  /** Bande « certaine » : un run de chiffres dans cette plage est un numéro. */
  strongMin: number;
  strongMax: number;
  /** Bande « contextuelle » : signalée seulement avec un indice téléphone. */
  contextualMin: number;
  contextualMax: number;
  /** Borne haute tolérée avec préfixe international (+ ou 00 + indicatif). */
  prefixedMax: number;
}

export const DEFAULT_CONTACT_CONFIG: ContactConfig = {
  strongMin: 10,
  strongMax: 12,
  contextualMin: 8,
  contextualMax: 9,
  prefixedMax: 13,
};

export type ContactReason =
  | 'digits'
  | 'number_words'
  | 'leet'
  | 'keyword'
  | 'email'
  | 'url'
  | 'handle';

export interface ContactDetection {
  hasContact: boolean;
  reasons: ContactReason[];
  /** Fragments d'origine ayant déclenché la détection. */
  matches: string[];
}

// ── Couche 1 : normalisation ────────────────────────────────────────────────

// Invisibles : espaces de largeur nulle, marques de direction, soft hyphen.
const INVISIBLE_RE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const COMBINING_RE = /[\u0300-\u036f]/g;

/** Replie les chiffres non-ASCII (arabo-indien, étendu, devanagari) vers 0-9. */
function foldDigits(value: string): string {
  let out = '';
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xff10 && cp <= 0xff19) out += String(cp - 0xff10); // ０-９
    else if (cp >= 0x0660 && cp <= 0x0669) out += String(cp - 0x0660); // ٠-٩
    else if (cp >= 0x06f0 && cp <= 0x06f9) out += String(cp - 0x06f0); // ۰-۹
    else if (cp >= 0x0966 && cp <= 0x096f) out += String(cp - 0x0966); // ०-९
    else out += ch;
  }
  return out;
}

/** Normalise un texte pour la détection (exporté pour les usages futurs). */
export function normalize(value: string): string {
  return foldDigits(value.replace(INVISIBLE_RE, '').normalize('NFKC'))
    .normalize('NFD')
    .replace(COMBINING_RE, '')
    .toLowerCase();
}

// ── Couche 2 : détecteurs ───────────────────────────────────────────────────

// Un « run » = un caractère de chiffre et tout ce qui suit (chiffres et
// séparateurs usuels). Les positions restent valides sur le texte d'origine,
// pour que `stripPhoneFromText` puisse retirer les fragments détectés.
const RUN_RE = /\+?[0-9][0-9\s.()+\-/_·\u00A0]*[0-9]|\+?[0-9]/g;

interface DigitRun {
  raw: string;
  digits: string;
  hadPlus: boolean;
}

function extractRuns(text: string): DigitRun[] {
  const runs: DigitRun[] = [];
  for (const match of text.matchAll(RUN_RE)) {
    const raw = match[0];
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) continue;
    const plus = raw.indexOf('+');
    const firstDigit = raw.search(/[0-9]/);
    runs.push({ raw, digits, hadPlus: plus !== -1 && plus < firstDigit });
  }
  return runs;
}

/**
 * Décide si un run de chiffres est un numéro de téléphone.
 * - 10-12 chiffres : certain ;
 * - 8-9 chiffres : seulement avec un indice (mot-clé téléphone ou préfixe) ;
 * - préfixe international (`+` ou `00`) : toléré jusqu'à 13 chiffres.
 */
function qualifiesContact(
  digits: string,
  hadPlus: boolean,
  hasKeyword: boolean,
  cfg: ContactConfig,
): boolean {
  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    if (rest.length >= cfg.strongMin && rest.length <= cfg.prefixedMax) return true;
  }
  const len = digits.length;
  if (len >= cfg.strongMin && len <= cfg.strongMax) return true;
  if (hadPlus && len >= cfg.strongMin && len <= cfg.prefixedMax) return true;
  if (len >= cfg.contextualMin && len <= cfg.contextualMax && (hasKeyword || hadPlus)) {
    return true;
  }
  return false;
}

// Nombres écrits en lettres (chiffres 0-9 uniquement : on exclut « mille »,
// « cent » pour ne pas fabriquer de faux positifs avec des multiplicateurs).
const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  un: '1',
  une: '1',
  deux: '2',
  trois: '3',
  quatre: '4',
  cinq: '5',
  six: '6',
  sept: '7',
  huit: '8',
  neuf: '9',
};
const NUMBER_WORD_RE = /\b(zero|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf)\b/g;

function mapNumberWords(text: string): string {
  return text.replace(NUMBER_WORD_RE, (word) => NUMBER_WORDS[word] ?? word);
}

// Repli leet : lettres utilisées comme chiffres. Appliqué uniquement aux tokens
// qui contiennent déjà au moins deux vrais chiffres (sinon « salut » deviendrait
// « 541u7 ») — c'est le garde-fou contre les faux positifs.
const LEET: Record<string, string> = {
  o: '0',
  l: '1',
  i: '1',
  e: '3',
  a: '4',
  s: '5',
  t: '7',
  b: '8',
  g: '9',
};
const TOKEN_SPLIT_RE = /([^a-z0-9]+)/;

function applyLeet(text: string): string {
  return text
    .split(TOKEN_SPLIT_RE)
    .map((token) => {
      if (!/[a-z]/.test(token)) return token;
      const digits = (token.match(/[0-9]/g) ?? []).length;
      if (digits < 2) return token;
      return token.replace(/[a-z]/g, (c) => LEET[c] ?? c);
    })
    .join('');
}

// Mots-clés de contournement, sur texte normalisé (sans accents, minuscules).
const KEYWORD_RE =
  /\b(?:telephone|tel|portable|mobile|cellulaire|joindre|joignez|appelez|appeler|contactez|numero|whatsapp|wapp|wpp|telegram|snapchat|instagram|messenger|viber)\b/;

// Regex de test (sans `g`, sinon `.test()` devient à état) et de remplacement
// (avec `g`) séparées : mêmes motifs, usages distincts.
const EMAIL_SRC = '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}';
const URL_SRC = '(?:https?:\\/\\/|www\\.)\\S+|(?:wa\\.me|t\\.me|bit\\.ly|tinyurl\\.com)\\S*';
const HANDLE_SRC = '@[a-z0-9._]{3,}';

const EMAIL_TEST_RE = new RegExp(EMAIL_SRC, 'i');
const URL_TEST_RE = new RegExp(URL_SRC, 'i');
const HANDLE_TEST_RE = new RegExp(HANDLE_SRC, 'i');

const EMAIL_ALL_RE = new RegExp(EMAIL_SRC, 'gi');
const URL_ALL_RE = new RegExp(URL_SRC, 'gi');
const HANDLE_ALL_RE = new RegExp(HANDLE_SRC, 'gi');

// ── Couche 3 : décision ─────────────────────────────────────────────────────

interface ScanResult {
  reasons: Set<ContactReason>;
  matches: string[];
}

function scanRuns(
  text: string,
  hasKeyword: boolean,
  cfg: ContactConfig,
  onMatch: (raw: string) => void,
): boolean {
  let found = false;
  for (const run of extractRuns(text)) {
    if (qualifiesContact(run.digits, run.hadPlus, hasKeyword, cfg)) {
      found = true;
      onMatch(run.raw);
    }
  }
  return found;
}

/** Analyse détaillée : raisons et fragments détectés. */
export function detectOffPlatformContact(
  value: string,
  cfg: ContactConfig = DEFAULT_CONTACT_CONFIG,
): ContactDetection {
  const result: ScanResult = { reasons: new Set(), matches: [] };
  const norm = normalize(value);
  const hasKeyword = KEYWORD_RE.test(norm);
  if (hasKeyword) result.reasons.add('keyword');

  if (EMAIL_TEST_RE.test(norm)) result.reasons.add('email');
  if (URL_TEST_RE.test(norm)) result.reasons.add('url');
  if (HANDLE_TEST_RE.test(norm)) result.reasons.add('handle');

  const record = (reason: ContactReason) => (raw: string) => {
    result.reasons.add(reason);
    result.matches.push(raw);
  };

  scanRuns(norm, hasKeyword, cfg, record('digits'));

  const withWords = mapNumberWords(norm);
  if (withWords !== norm) scanRuns(withWords, hasKeyword, cfg, record('number_words'));

  const withLeet = applyLeet(withWords);
  if (withLeet !== withWords) scanRuns(withLeet, hasKeyword, cfg, record('leet'));

  return {
    hasContact: result.reasons.size > 0,
    reasons: [...result.reasons],
    matches: result.matches,
  };
}

/** Vrai si le texte contient une coordonnée hors plateforme. */
export function containsOffPlatformContact(value: string): boolean {
  return detectOffPlatformContact(value).hasContact;
}

/** Alias historique (le nom reste utilisé par les appelants existants). */
export function containsPhoneNumber(value: string): boolean {
  return containsOffPlatformContact(value);
}

/** Retire les coordonnées détectées (nettoyage des annonces existantes). */
export function stripPhoneFromText(value: string): { text: string; changed: boolean } {
  const hasKeyword = KEYWORD_RE.test(normalize(value));
  let text = value
    .replace(EMAIL_ALL_RE, ' ')
    .replace(URL_ALL_RE, ' ')
    .replace(HANDLE_ALL_RE, ' ')
    .replace(new RegExp(KEYWORD_RE.source, 'gi'), ' ');
  text = text.replace(RUN_RE, (raw) => {
    const digits = raw.replace(/[^0-9]/g, '');
    const plus = raw.indexOf('+');
    const hadPlus = plus !== -1 && plus < raw.search(/[0-9]/);
    return qualifiesContact(digits, hadPlus, hasKeyword, DEFAULT_CONTACT_CONFIG) ? ' ' : raw;
  });
  text = text.replace(/\s{2,}/g, ' ').trim();
  return { text, changed: text !== value.trim() };
}
