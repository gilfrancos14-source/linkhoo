export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Miroir de backend/src/utils/phoneInText.ts : le serveur reste le filet de
// sécurité, ceci sert à afficher l'erreur avant l'envoi. La logique doit donc
// rester alignée, y compris pour les numéros écrits en lettres.

export const PHONE_IN_TEXT_ERROR =
  'Les numéros de téléphone et autres coordonnées (email, réseaux) ne sont pas autorisés : les clients vous contactent via la messagerie de la plateforme.';

// ── Normalisation ───────────────────────────────────────────────────────────

const INVISIBLE_RE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const COMBINING_RE = /[\u0300-\u036f]/g;

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

function normalize(value: string): string {
  return foldDigits(value.replace(INVISIBLE_RE, '').normalize('NFKC'))
    .normalize('NFD')
    .replace(COMBINING_RE, '')
    .toLowerCase();
}

// ── Détection des runs de chiffres ──────────────────────────────────────────

const RUN_RE = /\+?[0-9][0-9\s.()+\-/_·\u00A0]*[0-9]|\+?[0-9]/g;

function qualifiesContact(digits: string, hadPlus: boolean, hasKeyword: boolean): boolean {
  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    if (rest.length >= 10 && rest.length <= 13) return true;
  }
  const len = digits.length;
  if (len >= 10 && len <= 12) return true;
  if (hadPlus && len >= 10 && len <= 13) return true;
  if (len >= 8 && len <= 9 && (hasKeyword || hadPlus)) return true;
  return false;
}

function hasPhoneRun(text: string, hasKeyword: boolean): boolean {
  for (const match of text.matchAll(RUN_RE)) {
    const raw = match[0];
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) continue;
    const plus = raw.indexOf('+');
    const firstDigit = raw.search(/[0-9]/);
    const hadPlus = plus !== -1 && plus < firstDigit;
    if (qualifiesContact(digits, hadPlus, hasKeyword)) return true;
  }
  return false;
}

// ── Nombres écrits en lettres (français 0-99) ───────────────────────────────
//
// « cent » et « mille » sont exclus (faux positifs) ; des chiffres isolés
// successifs restent séparés, comme dans un numéro dicté.

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
  next: number;
}

function parseFrenchNumber(words: string[], index: number): ParsedNumber | null {
  const word = words[index];
  if (word === undefined) return null;

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

  if (word === 'dix') {
    const unit = UNITS[words[index + 1]];
    if (unit !== undefined && unit >= 7 && unit <= 9) {
      return { value: 10 + unit, next: index + 2 };
    }
    return { value: 10, next: index + 1 };
  }

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

// ── Repli leet ──────────────────────────────────────────────────────────────

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

// ── Autres canaux hors plateforme ───────────────────────────────────────────

const KEYWORD_RE =
  /\b(?:telephone|tel|portable|mobile|cellulaire|joindre|joignez|appelez|appeler|contactez|numero|whatsapp|wapp|wpp|telegram|snapchat|instagram|messenger|viber)\b/;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
const URL_RE = /(?:https?:\/\/|www\.)\S+|(?:wa\.me|t\.me|bit\.ly|tinyurl\.com)\S*/;
const HANDLE_RE = /@[a-z0-9._]{3,}/;

export function containsPhoneNumber(value: string): boolean {
  const norm = normalize(value);
  const hasKeyword = KEYWORD_RE.test(norm);
  if (hasKeyword) return true;
  if (EMAIL_RE.test(norm) || URL_RE.test(norm) || HANDLE_RE.test(norm)) return true;
  if (hasPhoneRun(norm, false)) return true;

  const withWords = mapNumberWords(norm);
  if (withWords !== norm && hasPhoneRun(withWords, false)) return true;

  const withLeet = applyLeet(withWords);
  if (withLeet !== withWords && hasPhoneRun(withLeet, false)) return true;

  return false;
}
