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

// Nombres écrits en lettres, en français (0-99) : un numéro peut être dicté
// « zéro six, zéro sept, douze, trente-quatre, cinquante-six » ou « zéro six
// zéro sept quatre-vingt-dix-neuf soixante et onze ». On convertit les
// séquences de mots-nombres en chiffres pour réutiliser la détection de runs.
//
// « cent » et « mille » sont volontairement exclus : un numéro de téléphone
// n'en a pas besoin et les multiplicateurs fabriquent des faux positifs.
// Des chiffres isolés successifs (« un deux trois ») restent séparés, comme
// dans un numéro dicté, au lieu d'être additionnés.
const UNITS: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
};

const TEENS: Record<string, number> = {
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
};

const TENS: Record<string, number> = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
};

interface ParsedNumber {
  value: number;
  /** Index du premier mot suivant le nombre consommé. */
  next: number;
}

/** Consomme un nombre français de 0 à 99 à partir de `index`, sinon null. */
function parseFrenchNumber(words: string[], index: number): ParsedNumber | null {
  const word = words[index];
  if (word === undefined) return null;

  // quatre-vingt(s) → 80, puis 81-99.
  if (word === 'quatre' && (words[index + 1] === 'vingt' || words[index + 1] === 'vingts')) {
    let value = 80;
    let next = index + 2;
    if (words[next] === 'et') next += 1;
    const tail = words[next];
    if (tail === 'dix') {
      value += 10;
      next += 1;
      const unit = UNITS[words[next]];
      if (unit !== undefined) {
        value += unit;
        next += 1;
      }
    } else if (TEENS[tail] !== undefined && TEENS[tail] >= 11) {
      value += TEENS[tail];
      next += 1;
    } else if (UNITS[tail] !== undefined && UNITS[tail] >= 1) {
      value += UNITS[tail];
      next += 1;
    }
    return { value, next };
  }

  // soixante → 60, puis 61-79 (soixante-dix-sept, soixante et onze, …).
  if (word === 'soixante') {
    let value = 60;
    let next = index + 1;
    if (words[next] === 'et') next += 1;
    const tail = words[next];
    if (tail === 'dix') {
      value += 10;
      next += 1;
      const unit = UNITS[words[next]];
      if (unit !== undefined) {
        value += unit;
        next += 1;
      }
    } else if (TEENS[tail] !== undefined && TEENS[tail] >= 10) {
      value += TEENS[tail];
      next += 1;
    } else if (UNITS[tail] !== undefined && UNITS[tail] >= 1) {
      value += UNITS[tail];
      next += 1;
    }
    return { value, next };
  }

  if (TENS[word] !== undefined) {
    let value = TENS[word];
    let next = index + 1;
    if (words[next] === 'et') next += 1;
    const unit = UNITS[words[next]];
    if (unit !== undefined && unit >= 1) {
      value += unit;
      next += 1;
    }
    return { value, next };
  }

  // dix → 10 seul, ou 17-19 (dix-sept, dix-huit, dix-neuf).
  if (word === 'dix') {
    const unit = UNITS[words[index + 1]];
    if (unit !== undefined && unit >= 7 && unit <= 9) {
      return { value: 10 + unit, next: index + 2 };
    }
    return { value: 10, next: index + 1 };
  }

  // onze … seize, quand ils ne suivent pas une dizaine.
  const teen = TEENS[word];
  if (teen !== undefined) return { value: teen, next: index + 1 };

  const unit = UNITS[word];
  if (unit !== undefined) return { value: unit, next: index + 1 };

  return null;
}

const WORD_RE = /[a-z]+/g;

function mapNumberWords(text: string): string {
  const matches = [...text.matchAll(WORD_RE)];
  if (matches.length === 0) return text;
  const words = matches.map((match) => match[0]);

  let out = '';
  let copiedUntil = 0;
  let index = 0;

  while (index < matches.length) {
    const parsed = parseFrenchNumber(words, index);
    if (!parsed) {
      index += 1;
      continue;
    }

    const start = matches[index].index ?? 0;
    const values = [parsed.value];
    let next = parsed.next;
    while (next < matches.length) {
      const following = parseFrenchNumber(words, next);
      if (!following) break;
      values.push(following.value);
      next = following.next;
    }

    const lastMatch = matches[next - 1];
    const end = (lastMatch.index ?? 0) + lastMatch[0].length;
    out += `${text.slice(copiedUntil, start)}${values.join(' ')}`;
    copiedUntil = end;
    index = next;
  }

  return out + text.slice(copiedUntil);
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
