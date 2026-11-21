import type { MarketCode } from '../config/markets';

/**
 * Indicatifs + forme des numéros par marché (E.164 sans le "+").
 * Source de vérité unique : inscription gérant + pipeline pawaPay.
 */
interface PhoneRule {
  /** Indicatif pays (sans +). */
  code: string;
  /** Longueur TOTALE attendue en chiffres (indicatif + national), E.164. */
  totalLength: number;
  /** Préfixes nationaux mobiles plausibles (sans le 0 de troncage). */
  mobilePrefixes: string[];
}

export const PHONE_RULES: Record<MarketCode, PhoneRule> = {
  // Côte d'Ivoire : +225 + 10 chiffres (07, 05, 01, 27…)
  CI: { code: '225', totalLength: 13, mobilePrefixes: ['0', '2', '5', '7', '4', '6', '3', '8', '9'] },
  // Bénin : +229 + 10 chiffres (01, 96, 97, 98…)
  BJ: { code: '229', totalLength: 13, mobilePrefixes: ['0', '9'] },
  // Sénégal : +221 + 9 chiffres (70-79)
  SN: { code: '221', totalLength: 12, mobilePrefixes: ['7'] },
  // Togo : +228 + 8 chiffres (90, 91, 92, 93, 96, 97, 98, 99, 70…)
  TG: { code: '228', totalLength: 11, mobilePrefixes: ['7', '9'] },
  // Cameroun : +237 + 9 chiffres (6, 7, 8, 9)
  CM: { code: '237', totalLength: 12, mobilePrefixes: ['6', '7', '8', '9'] },
  // Burkina : +226 + 8 chiffres (70, 71, 76, 78…)
  BF: { code: '226', totalLength: 11, mobilePrefixes: ['7'] },
  // Congo : +242 + 9 chiffres (06, 05…)
  CG: { code: '242', totalLength: 12, mobilePrefixes: ['0'] },
  // Gabon : +241 + 9 chiffres (06, 07…)
  GA: { code: '241', totalLength: 12, mobilePrefixes: ['0', '6', '7'] },
  // Guinée : +224 + 9 chiffres
  GN: { code: '224', totalLength: 12, mobilePrefixes: ['6'] },
  // Mali : +223 + 8 chiffres (65-69, 76, 79)
  ML: { code: '223', totalLength: 11, mobilePrefixes: ['6', '7'] },
  // Niger : +227 + 8 chiffres
  NE: { code: '227', totalLength: 11, mobilePrefixes: ['8', '9'] },
  // RDC : +243 + 9 chiffres (81, 82, 89, 97…)
  CD: { code: '243', totalLength: 12, mobilePrefixes: ['8', '9'] },
};

/** Indicatifs par marché (re-export pour compatibilité). */
export const COUNTRY_CODE_BY_MARKET: Record<MarketCode, string> = Object.fromEntries(
  Object.entries(PHONE_RULES).map(([m, r]) => [m, r.code]),
) as Record<MarketCode, string>;

function digitsOf(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Extrait la partie nationale (sans indicatif) d'un numéro pour un marché.
 * Gère : +225…, 225…, 00225…, et le format local 07…
 */
export function nationalNumber(phone: string, market: MarketCode): string | null {
  const rule = PHONE_RULES[market];
  if (!rule) return null;
  const digits = digitsOf(phone);
  if (digits.startsWith(rule.code)) return digits.slice(rule.code.length);
  if (digits.startsWith(`00${rule.code}`)) return digits.slice(rule.code.length + 2);
  return digits; // format local
}

/**
 * Vrai si le numéro est BIEN FORMÉ pour le marché déclaré.
 *
 * Vérifie :
 *  1. pas d'indicatif d'un AUTRE marché supporté ;
 *  2. la longueur totale (format international) OU la longueur nationale (format local) ;
 *  3. un préfixe mobile plausible.
 *
 * Refuse donc +2250000000000 (trop court / mauvais préfixe) et +229… sur le CI.
 * NOTE : cela valide la STRUCTURE, pas l'existence réelle de la ligne — seul un
 * SMS/OTP pourrait prouver que le numéro appartient vraiment à la personne.
 */
export function phoneMatchesMarket(phone: string | null | undefined, market: MarketCode): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const rule = PHONE_RULES[market];
  if (!rule) return false;

  const digits = digitsOf(phone);
  if (digits.length < 8 || digits.length > 15) return false;

  // Indicatif d'un autre marché → refus catégorique.
  const foreign = Object.entries(PHONE_RULES).find(
    ([m, r]) => m !== market && digits.startsWith(r.code),
  );
  if (foreign) return false;

  const national = nationalNumber(phone, market) ?? '';
  if (!national) return false;

  // Longueur NATIONALE exacte, quelle que soit la forme (+225, 00225, local).
  const expectedNationalLength = rule.totalLength - rule.code.length;
  if (national.length !== expectedNationalLength) return false;

  // Préfixe mobile plausible.
  if (!rule.mobilePrefixes.some((p) => national.startsWith(p))) return false;

  // Rejette les numéros « bidon » tout chiffres identiques (0000000000).
  if (/^(\d)\1+$/.test(national)) return false;

  return true;
}
