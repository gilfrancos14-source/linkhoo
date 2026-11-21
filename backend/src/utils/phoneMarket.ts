import type { MarketCode } from '../config/markets';

/**
 * Indicatifs téléphoniques par marché (E.164 sans le "+").
 * Source de vérité unique : utilisée à l'inscription (contrôle gérant) et
 * par le pipeline pawaPay (formatage MSISDN).
 */
export const COUNTRY_CODE_BY_MARKET: Record<MarketCode, string> = {
  CI: '225',
  BJ: '229',
  SN: '221',
  TG: '228',
  CM: '237',
  BF: '226',
  CG: '242',
  GA: '241',
  GN: '224',
  ML: '223',
  NE: '227',
  CD: '243',
};

/** Chiffres d'un numéro, sans séparateurs. */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Vrai si le numéro appartient au marché déclaré.
 *
 * Accepte :
 *   - format international  +225 07..., 22507..., 00225...
 *   - format local          07... (indicatif implicite du marché)
 *
 * Refuse un numéro manifestement d'un autre pays (ex. +229 sur le marché CI).
 * Les numéros trop courts (< 6 chiffres utiles) sont refusés aussi.
 */
export function phoneMatchesMarket(phone: string | null | undefined, market: MarketCode): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const digits = digitsOf(phone);
  if (digits.length < 8) return false; // ~6 chiffres locaux + indicatif

  const code = COUNTRY_CODE_BY_MARKET[market];
  if (!code) return false;

  // Formats avec indicatif explicite.
  if (digits.startsWith(code)) return true;
  if (digits.startsWith(`00${code}`)) return true; // 00 préfixe international

  // Format local : pas d'indicatif étranger reconnu → on considère qu'il
  // appartient au marché déclaré (le client a saisi son numéro local).
  const foreignCode = Object.entries(COUNTRY_CODE_BY_MARKET).find(
    ([m, c]) => m !== market && digits.startsWith(c),
  );
  if (foreignCode) return false; // indicatif d'un AUTRE marché supporté → refus

  // Numéro local sans indicatif connu : accepté (on ne peut pas prouver le
  // contraire). Un indicatif non-Afrique-de-l'Ouest (ex. +33) serait rejeté
  // plus haut par la longueur / ne correspond à aucun marché → on l'accepte
  // aussi ; le contrôle KYC admin reste la source de vérité.
  const local = digits.replace(/^0+/, '');
  return local.length >= 6;
}
