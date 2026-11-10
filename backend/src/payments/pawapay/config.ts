/**
 * Configuration des paiements pawaPay — source de vérité BACKEND.
 *
 * Deux couches distinctes :
 *
 *   1. `PAWAPAY_MARKETS` : ce que pawaPay expose réellement, marché par marché.
 *
 *   2. `getPawapayConfig()` : secrets et réglages d'exécution lus dans
 *      l'environnement. Aucune clé n'est jamais exposée au front.
 */

import { MARKET_CODES, type MarketCode } from '../../config/markets';
import type { PawapayConfig, PawapayCurrency, PawapayEnvironment } from './types';

export type { MarketCode, PawapayCurrency, PawapayEnvironment };

export type PawapayPaymentMethod = 'mobile_money' | 'bank_transfer';

export interface MarketPaymentConfig {
  readonly currency: PawapayCurrency;
  readonly methods: readonly PawapayPaymentMethod[];
  readonly providers: readonly string[];
  readonly onlinePaymentEnabled: boolean;
}

export const PAWAPAY_MARKETS: Record<MarketCode, MarketPaymentConfig> = {
  CI: { currency: 'XOF', methods: ['mobile_money'], providers: ['MTN_MOMO_CIV', 'ORANGE_CIV', 'WAVE_CIV'], onlinePaymentEnabled: true },
  BJ: { currency: 'XOF', methods: ['mobile_money'], providers: ['MTN_MOMO_BEN', 'MOOV_BEN'], onlinePaymentEnabled: true },
  SN: { currency: 'XOF', methods: ['mobile_money'], providers: ['FREE_SEN', 'ORANGE_SEN', 'WAVE_SEN'], onlinePaymentEnabled: true },
  TG: { currency: 'XOF', methods: [], providers: [], onlinePaymentEnabled: false },
  CM: { currency: 'XAF', methods: ['mobile_money'], providers: ['MTN_MOMO_CMR', 'ORANGE_CMR'], onlinePaymentEnabled: true },
  BF: { currency: 'XOF', methods: ['mobile_money'], providers: ['MOOV_BFA', 'ORANGE_BFA'], onlinePaymentEnabled: true },
  CG: { currency: 'XAF', methods: ['mobile_money'], providers: ['AIRTEL_COG', 'MTN_MOMO_COG'], onlinePaymentEnabled: true },
  GA: { currency: 'XAF', methods: ['mobile_money'], providers: ['AIRTEL_GAB', 'MTN_MOMO_GAB'], onlinePaymentEnabled: true },
  GN: { currency: 'GNF', methods: [], providers: [], onlinePaymentEnabled: false },
  ML: { currency: 'XOF', methods: [], providers: [], onlinePaymentEnabled: false },
  NE: { currency: 'XOF', methods: [], providers: [], onlinePaymentEnabled: false },
  CD: { currency: 'XOF', methods: [], providers: [], onlinePaymentEnabled: false },
};

export const MIN_AMOUNT_BY_CURRENCY: Record<PawapayCurrency, number> = {
  XOF: 500, XAF: 500, GNF: 1, GHS: 1, NGN: 100, KES: 1, UGX: 100, RWF: 1, TZS: 1, USD: 1,
};

export class PawapayConfigError extends Error {
  readonly code:
    | 'PAWAPAY_NOT_CONFIGURED'
    | 'PAWAPAY_INVALID_ENV'
    | 'PAWAPAY_SANDBOX_IN_PRODUCTION'
    | 'MARKET_NOT_SUPPORTED'
    | 'FX_RATE_MISSING'
    | 'RETURN_URL_NOT_HTTPS'
    | 'AMOUNT_OUT_OF_RANGE'
    | 'CHECKOUT_PERSIST_FAILED';

  constructor(code: PawapayConfigError['code'], message: string) {
    super(message);
    this.name = 'PawapayConfigError';
    this.code = code;
  }
}

export function getMarketPaymentConfig(market: MarketCode): MarketPaymentConfig {
  return PAWAPAY_MARKETS[market];
}

export function isMarketSupported(market: MarketCode): boolean {
  const config = PAWAPAY_MARKETS[market];
  return config.onlinePaymentEnabled && config.providers.length > 0 && config.methods.length > 0;
}

export function supportedMarkets(): MarketCode[] {
  return MARKET_CODES.filter(isMarketSupported);
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

function readEnvironment(raw: string | undefined): PawapayEnvironment {
  const value = (raw || 'sandbox').trim().toLowerCase();
  if (value === 'live' || value === 'production') return 'production';
  if (value === 'sandbox' || value === 'test') return 'sandbox';
  throw new PawapayConfigError(
    'PAWAPAY_INVALID_ENV',
    `PAWAPAY_ENV invalide ("${raw}") : attendu "sandbox" ou "live".`,
  );
}

/**
 * Lit et valide la configuration pawaPay.
 *
 * SÉCURITÉ : `applyEvents` est FALSE par défaut. Il faut explicitement
 * `PAYMENTS_APPLY_EVENTS=true` pour activer le traitement des webhooks.
 * Ce comportement est identique en dev et en prod : pas de « switch »
 * automatique. Les callbacks doivent alors être signés (RFC 9421) et la
 * vérification est obligatoire en production (voir `verifyCallbacks`).
 *
 * Pour activer les webhooks pawaPay :
 *   1. `PAYMENTS_APPLY_EVENTS=true` dans `.env` ;
 *   2. activer « signed callbacks » dans le dashboard pawaPay ;
 *   3. en production, `PAWAPAY_VERIFY_CALLBACKS` est forcé à `true`.
 */
export function getPawapayConfig(env: NodeJS.ProcessEnv = process.env): PawapayConfig {
  const apiKey = env.PAWAPAY_API_KEY?.trim();
  const merchantId = env.PAWAPAY_MERCHANT_ID?.trim();
  if (!apiKey || !merchantId) {
    throw new PawapayConfigError(
      'PAWAPAY_NOT_CONFIGURED',
      'PAWAPAY_API_KEY et PAWAPAY_MERCHANT_ID sont requis pour appeler pawaPay.',
    );
  }

  const environment = readEnvironment(env.PAWAPAY_ENV);
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction && environment === 'sandbox') {
    throw new PawapayConfigError(
      'PAWAPAY_SANDBOX_IN_PRODUCTION',
      'PAWAPAY_ENV=sandbox est interdit en production : utilisez PAWAPAY_ENV=live.',
    );
  }

  // L'URL suit l'environnement : plus de sandbox silencieux avec PAWAPAY_ENV=live.
  const defaultBaseUrl =
    environment === 'production'
      ? 'https://api.pawapay.io'
      : 'https://api.sandbox.pawapay.io';
  const baseUrl = (env.PAWAPAY_BASE_URL?.trim() || defaultBaseUrl).replace(/\/+$/, '');

  // Garde-fou : en production, on refuse une URL sandbox même si elle est
  // fournie explicitement (une faute de frappe ne doit pas envoyer de vrais
  // paiements dans le sandbox).
  if (isProduction && /(^|\.)sandbox\./.test(new URL(baseUrl).hostname)) {
    throw new PawapayConfigError(
      'PAWAPAY_SANDBOX_IN_PRODUCTION',
      `PAWAPAY_BASE_URL pointe vers le sandbox (${baseUrl}) en production.`,
    );
  }

  // En production, la vérification des callbacks est OBLIGATOIRE. En dev,
  // elle est opt-in via PAWAPAY_VERIFY_CALLBACKS=true (log-only sinon).
  const rawVerify = env.PAWAPAY_VERIFY_CALLBACKS?.trim().toLowerCase();
  const verifyCallbacks = isProduction ? true : rawVerify === 'true';

  return {
    baseUrl,
    apiKey,
    merchantId,
    environment,
    verifyCallbacks,
    timeoutMs: parseInteger(env.PAWAPAY_TIMEOUT_MS, 15_000, 1_000, 60_000),
    checkoutTtlMinutes: parseInteger(env.PAWAPAY_CHECKOUT_TTL_MINUTES, 30, 3, 60),
    // Défaut FALSE : les webhooks sont ignorés tant qu'on ne l'active pas
    // explicitement. Voir la doc ci-dessus.
    applyEvents: env.PAYMENTS_APPLY_EVENTS === 'true',
  };
}