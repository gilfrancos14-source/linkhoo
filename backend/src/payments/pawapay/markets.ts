/**
 * Gestion des marchés pawaPay.
 *
 * pawaPay attend des montants en unités ENTIÈRES (5000 XOF = "5000"), pas en
 * centimes. La validation dynamique des bornes vit dans `activeConf.ts`.
 */

import {
  PAWAPAY_MARKETS,
  MIN_AMOUNT_BY_CURRENCY,
  type MarketCode,
  type PawapayPaymentMethod,
} from './config';

export function validateAmountForMarket(market: MarketCode, amount: number): void {
  const config = PAWAPAY_MARKETS[market];
  const minAmount = MIN_AMOUNT_BY_CURRENCY[config.currency];
  const maxAmount = 10_000_000;

  if (amount < minAmount) {
    throw new Error(
      `Le montant minimum pour ${market} est ${minAmount} ${config.currency}`,
    );
  }

  if (amount > maxAmount) {
    throw new Error(
      `Le montant maximum pour ${market} est ${maxAmount} ${config.currency}`,
    );
  }
}

export function formatPhoneNumberForPawapay(phoneNumber: string, country: MarketCode): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Le numéro de téléphone est vide');
  }

  const countryCodes: Record<MarketCode, string> = {
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

  const countryCode = countryCodes[country];
  if (!countryCode) {
    throw new Error(`Code pays non supporté: ${country}`);
  }

  if (digits.startsWith(countryCode)) return digits;
  const local = digits.replace(/^0+/, '');
  if (local.length < 6) {
    throw new Error(`Numéro de téléphone invalide pour ${country}`);
  }
  return `${countryCode}${local}`;
}

export function getAvailableProviders(market: MarketCode): readonly string[] {
  return PAWAPAY_MARKETS[market].providers;
}

export function isProviderAvailable(market: MarketCode, provider: string): boolean {
  return PAWAPAY_MARKETS[market].providers.includes(provider);
}

export function getAvailablePaymentMethods(market: MarketCode): readonly PawapayPaymentMethod[] {
  return PAWAPAY_MARKETS[market].methods;
}

export function isPaymentMethodAvailable(
  market: MarketCode,
  method: PawapayPaymentMethod,
): boolean {
  return PAWAPAY_MARKETS[market].methods.includes(method);
}

// Les helpers historiques `formatAmountForPawapay` / `parseAmountFromPawapay`
// (×100/÷100), `convertCurrency` (taux fictifs) et `validateActiveConf`
// (comparaison ISO3 vs code 2 lettres) ont été supprimés : ils étaient
// inutilisés et porteurs de bugs. La validation des montants vit désormais
// dans `validateAmountForMarket` (statique) et `activeConf.ts` (dynamique).