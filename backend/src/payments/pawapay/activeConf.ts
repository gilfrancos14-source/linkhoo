/**
 * Cache et validation de la configuration active pawaPay.
 *
 * `/v2/active-conf` renvoie, par pays et type d'opération, les opérateurs
 * réellement disponibles et les bornes de montant (`minAmount`/`maxAmount`).
 * Les valeurs statiques de `config.ts` ne sont qu'un filet de sécurité : la
 * source de vérité reste pawaPay.
 *
 * Le cache évite un appel réseau à chaque checkout. En cas de panne de cet
 * endpoint, l'appelant (checkouts.ts) conserve les bornes statiques.
 */

import { PawapayClient } from './client';
import { PawapayConfigError } from './config';
import type { PawapayActiveConfResult, PawapayCurrency } from './types';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  data: PawapayActiveConfResult;
}

const cache = new Map<string, CacheEntry>();

/** Vide le cache (tests ou rechargement manuel). */
export function resetActiveConfCache(): void {
  cache.clear();
}

export async function getActiveConf(
  client: PawapayClient,
  country: string,
  operationType: 'DEPOSIT' | 'PAYOUT' | 'REFUND',
  now: number = Date.now(),
): Promise<PawapayActiveConfResult> {
  const key = `${country.trim().toUpperCase()}:${operationType}`;
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await client.getActiveConf(country, operationType);
  cache.set(key, { at: now, data });
  return data;
}

interface AmountRange {
  min: number;
  max: number;
}

function depositRanges(
  conf: PawapayActiveConfResult,
  countryIso3: string,
  currency: PawapayCurrency,
): AmountRange[] {
  const target = countryIso3.trim().toUpperCase();
  const country = conf.countries.find((entry) => entry.country.toUpperCase() === target);
  if (!country) {
    throw new PawapayConfigError(
      'MARKET_NOT_SUPPORTED',
      `Aucune configuration active pawaPay pour le pays ${countryIso3}.`,
    );
  }

  const ranges: AmountRange[] = [];
  for (const provider of country.providers) {
    for (const entry of provider.currencies) {
      if (entry.currency !== currency) continue;
      const deposit = entry.operationTypes?.DEPOSIT;
      if (!deposit) continue;

      const min = Number(deposit.minAmount);
      const max = Number(deposit.maxAmount);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        ranges.push({ min, max });
      }
    }
  }

  return ranges;
}

/**
 * Vérifie que `amount` (dans `currency`) est acceptable pour au moins un
 * opérateur pawaPay du pays. Lève `PawapayConfigError('AMOUNT_OUT_OF_RANGE')`
 * si aucune plage ne couvre le montant.
 */
export async function assertDepositAmountAllowed(
  client: PawapayClient,
  countryIso3: string,
  currency: PawapayCurrency,
  amount: number,
): Promise<void> {
  const conf = await getActiveConf(client, countryIso3, 'DEPOSIT');
  const ranges = depositRanges(conf, countryIso3, currency);

  if (ranges.length === 0) {
    throw new PawapayConfigError(
      'MARKET_NOT_SUPPORTED',
      `Aucun opérateur pawaPay n'accepte ${currency} pour le pays ${countryIso3}.`,
    );
  }

  const allowed = ranges.some((range) => amount >= range.min && amount <= range.max);
  if (!allowed) {
    const min = Math.min(...ranges.map((range) => range.min));
    const max = Math.max(...ranges.map((range) => range.max));
    throw new PawapayConfigError(
      'AMOUNT_OUT_OF_RANGE',
      `Montant ${amount} ${currency} hors limites pawaPay pour ${countryIso3} (${min}–${max}).`,
    );
  }
}
