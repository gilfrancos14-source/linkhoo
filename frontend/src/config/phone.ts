import type { MarketCode } from './markets';

/**
 * Miroir frontend des règles de numéros du backend (`utils/phoneMarket.ts`).
 * Sert à valider le numéro saisi dans le popup d'inscription gérant avant
 * d'autoriser le formulaire Clerk ; le backend refait la même vérification.
 */
interface PhoneRule {
  code: string;
  nationalLength: number;
  mobilePrefixes: string[];
}

export const PHONE_RULES: Record<MarketCode, PhoneRule> = {
  CI: { code: '225', nationalLength: 10, mobilePrefixes: ['0', '2', '5', '7', '4', '6', '3', '8', '9'] },
  BJ: { code: '229', nationalLength: 10, mobilePrefixes: ['0', '9'] },
  SN: { code: '221', nationalLength: 9, mobilePrefixes: ['7'] },
  TG: { code: '228', nationalLength: 8, mobilePrefixes: ['7', '9'] },
  CM: { code: '237', nationalLength: 9, mobilePrefixes: ['6', '7', '8', '9'] },
  BF: { code: '226', nationalLength: 8, mobilePrefixes: ['7'] },
  CG: { code: '242', nationalLength: 9, mobilePrefixes: ['0'] },
  GA: { code: '241', nationalLength: 9, mobilePrefixes: ['0', '6', '7'] },
  GN: { code: '224', nationalLength: 9, mobilePrefixes: ['6'] },
  ML: { code: '223', nationalLength: 8, mobilePrefixes: ['6', '7'] },
  NE: { code: '227', nationalLength: 8, mobilePrefixes: ['8', '9'] },
  CD: { code: '243', nationalLength: 9, mobilePrefixes: ['8', '9'] },
};

export const PHONE_PREFIXES: Record<MarketCode, string> = Object.fromEntries(
  Object.entries(PHONE_RULES).map(([market, rule]) => [market, `+${rule.code}`]),
) as Record<MarketCode, string>;

export function phoneMatchesMarket(value: string | null | undefined, market: MarketCode): boolean {
  if (!value || typeof value !== 'string') return false;
  const rule = PHONE_RULES[market];
  if (!rule) return false;

  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;

  const foreign = Object.entries(PHONE_RULES).find(
    ([code, other]) => code !== market && digits.startsWith(other.code),
  );
  if (foreign) return false;

  const national = digits.startsWith(rule.code)
    ? digits.slice(rule.code.length)
    : digits.startsWith(`00${rule.code}`)
      ? digits.slice(rule.code.length + 2)
      : digits;
  if (national.length !== rule.nationalLength) return false;
  if (!rule.mobilePrefixes.some((prefix) => national.startsWith(prefix))) return false;
  if (/^(\d)\1+$/.test(national)) return false;

  return true;
}
