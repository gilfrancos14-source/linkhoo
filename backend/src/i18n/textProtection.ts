/**
 * Avant traduction, on retire ce qui ne doit pas être traduit ou reformulé :
 * montants en FCFA, emails, URLs, numéros de téléphone, nombres seuls.
 * Les valeurs sont remplacées par des jetons alphanumériques que le modèle
 * recopie tels quels, puis restaurés après génération.
 */

const PROTECTED_PATTERNS: readonly RegExp[] = [
  /https?:\/\/[^\s<>"')\]]+/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?225|00 ?225)[ (.-]?\d{2}(?:[ .-]?\d{2}){4}\b/g,
  /\b\d[\d\s.,]*\s?(?:FCFA|XOF|€|\$|USD|EUR)\b/gi,
  /\b\d{3,}\b/g,
];

/** Termes du métier que l'on veut retrouver à l'identique dans la cible. */
const GLOSSARY: Readonly<Record<string, string>> = {
  fcfa: 'FCFA',
  xof: 'XOF',
  linkhoo: 'Linkhoo',
  ilehya: 'Ilehya',
};

export interface ProtectedText {
  text: string;
  restore: (translated: string) => string;
}

function makeToken(index: number): string {
  return `ZTOK${index}Z`;
}

export function protectText(input: string, protectedTerms: readonly string[] = []): ProtectedText {
  const values: string[] = [];
  let text = String(input ?? '');

  // Villes, quartiers et pays viennent de la fiche : ce sont des noms propres
  // que le modèle a tendance à reformuler (ex. « Cocody » → « 5ody »).
  for (const term of protectedTerms) {
    const value = String(term ?? '').trim();
    if (value.length < 3) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), () => {
      const index = values.push(value) - 1;
      return makeToken(index);
    });
  }

  for (const pattern of PROTECTED_PATTERNS) {
    text = text.replace(pattern, (match) => {
      const index = values.push(match) - 1;
      return makeToken(index);
    });
  }

  for (const [source, target] of Object.entries(GLOSSARY)) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), () => {
      const index = values.push(target) - 1;
      return makeToken(index);
    });
  }

  return {
    text,
    restore: (translated: string) =>
      translated.replace(/ZTOK(\d+)Z/g, (token, raw: string) => {
        const value = values[Number(raw)];
        return value === undefined ? token : value;
      }),
  };
}

/** Comparaison simple pour l'aller-retour FR → EN → FR (file « À revoir »). */
export function similarity(a: string, b: string): number {
  const words = (value: string) =>
    new Set(
      String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 2),
    );
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common / Math.max(left.size, right.size);
}
