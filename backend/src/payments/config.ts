/**
 * Configuration des paiements Hub2 — source de vérité BACKEND.
 *
 * Deux couches distinctes :
 *
 *   1. `HUB2_MARKETS` : ce que Hub2 expose réellement, marché par marché
 *      (devise, moyens de paiement, opérateurs). Relevé sur
 *      `GET https://api.hub2.io/data/providers`. NE et CD n'exposent AUCUN
 *      opérateur : ils restent hors paiement en ligne.
 *
 *   2. `getHub2Config()` : les secrets et réglages d'exécution, lus dans
 *      l'environnement. Aucune clé n'est jamais exposée au front : seul le
 *      `checkout_url` sort du backend.
 *
 * Le module est volontairement sans effet de bord au chargement (pas de
 * `process.exit`) : la configuration est validée à l'usage, ce qui permet de
 * démarrer l'API même si Hub2 n'est pas encore branché (mode observation).
 */

import { MARKET_CODES, type MarketCode } from '../config/markets';
import type { Hub2Config, Hub2Currency, Hub2Environment } from './types';

export type Hub2PaymentMethod = 'mobile_money' | 'credit_card' | 'bank_transfer' | 'instant_payment';

export interface MarketPaymentConfig {
  /** Devise réellement débitée par Hub2 sur ce marché. */
  readonly currency: Hub2Currency;
  readonly methods: readonly Hub2PaymentMethod[];
  /** Noms d'opérateurs en minuscules, tels que Hub2 les attend. */
  readonly providers: readonly string[];
  /** false => pas de checkout, la réservation suit le circuit direct. */
  readonly onlinePaymentEnabled: boolean;
}

/**
 * Couverture Hub2 au 27/10/2026.
 *
 * Les opérateurs sont recopiés en minuscules : Hub2 les accepte sans tenir
 * compte de la casse, et une comparaison normalisée évite les doublons
 * (« Wave » vs « wave »).
 */
export const HUB2_MARKETS: Record<MarketCode, MarketPaymentConfig> = {
  CI: {
    currency: 'XOF',
    methods: ['mobile_money', 'credit_card', 'bank_transfer'],
    providers: ['orange', 'mtn', 'moov', 'wave', 'ecobank', 'bda'],
    onlinePaymentEnabled: true,
  },
  BJ: {
    currency: 'XOF',
    methods: ['mobile_money'],
    providers: ['moov', 'mtn', 'celtiis'],
    onlinePaymentEnabled: true,
  },
  SN: {
    currency: 'XOF',
    methods: ['mobile_money'],
    providers: ['orange', 'free', 'emoney', 'wave'],
    onlinePaymentEnabled: true,
  },
  TG: {
    currency: 'XOF',
    methods: ['mobile_money'],
    providers: ['moov', 'togocell'],
    onlinePaymentEnabled: true,
  },
  CM: {
    currency: 'XAF',
    methods: ['mobile_money'],
    providers: ['orange', 'mtn'],
    onlinePaymentEnabled: true,
  },
  BF: {
    currency: 'XOF',
    methods: ['mobile_money'],
    providers: ['orange', 'mobicash', 'moov', 'wave'],
    onlinePaymentEnabled: true,
  },
  CG: {
    currency: 'XAF',
    methods: ['mobile_money'],
    providers: ['mtn', 'airtel'],
    onlinePaymentEnabled: true,
  },
  GA: {
    currency: 'XAF',
    methods: ['mobile_money'],
    providers: ['airtel', 'moov', 'mobicash'],
    onlinePaymentEnabled: true,
  },
  GN: {
    currency: 'GNF',
    methods: ['mobile_money'],
    providers: ['orange', 'mtn'],
    onlinePaymentEnabled: true,
  },
  ML: {
    currency: 'XOF',
    methods: ['mobile_money'],
    providers: ['orange', 'mobicash'],
    onlinePaymentEnabled: true,
  },
  // Hub2 n'expose aucun opérateur : le paiement en ligne restera fermé tant
  // qu'un prestataire local n'est pas branché.
  NE: {
    currency: 'XOF',
    methods: [],
    providers: [],
    onlinePaymentEnabled: false,
  },
  CD: {
    currency: 'XOF',
    methods: [],
    providers: [],
    onlinePaymentEnabled: false,
  },
};

/** Montant minimum accepté par Hub2, dans la plus petite unité de la devise. */
export const MIN_AMOUNT_BY_CURRENCY: Record<Hub2Currency, number> = {
  XOF: 500,
  XAF: 500,
  // La documentation ne fixe un minimum que pour XOF/XAF. 1 GNF évite de
  // refuser un montant valide si le taux rend la contre-valeur très faible.
  GNF: 1,
};

export class Hub2ConfigError extends Error {
  readonly code:
    | 'HUB2_NOT_CONFIGURED'
    | 'HUB2_INVALID_ENV'
    | 'HUB2_SANDBOX_IN_PRODUCTION';

  constructor(code: Hub2ConfigError['code'], message: string) {
    super(message);
    this.name = 'Hub2ConfigError';
    this.code = code;
  }
}

export function getMarketPaymentConfig(market: MarketCode): MarketPaymentConfig {
  return HUB2_MARKETS[market];
}

/** Vrai si un checkout Hub2 peut être ouvert sur ce marché. */
export function isMarketSupported(market: MarketCode): boolean {
  const config = HUB2_MARKETS[market];
  return config.onlinePaymentEnabled && config.providers.length > 0 && config.methods.length > 0;
}

/** Tous les marchés réellement payables en ligne (utile au back-office). */
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

function readEnvironment(raw: string | undefined): Hub2Environment {
  const value = (raw || 'sandbox').trim().toLowerCase();
  if (value === 'live' || value === 'production') return 'live';
  if (value === 'sandbox' || value === 'test') return 'sandbox';
  throw new Hub2ConfigError(
    'HUB2_INVALID_ENV',
    `HUB2_ENV invalide ("${raw}") : attendu "sandbox" ou "live".`,
  );
}

/**
 * Lit et valide la configuration Hub2.
 *
 * Lève `Hub2ConfigError` plutôt que de retourner une config partielle : un
 * appel API avec une clé vide produirait une erreur d'authentification
 * opaque, plus difficile à diagnostiquer qu'un refus explicite.
 */
export function getHub2Config(env: NodeJS.ProcessEnv = process.env): Hub2Config {
  const apiKey = env.HUB2_API_KEY?.trim();
  const merchantId = env.HUB2_MERCHANT_ID?.trim();
  if (!apiKey || !merchantId) {
    throw new Hub2ConfigError(
      'HUB2_NOT_CONFIGURED',
      'HUB2_API_KEY et HUB2_MERCHANT_ID sont requis pour appeler Hub2.',
    );
  }

  const environment = readEnvironment(env.HUB2_ENV);

  // Une clé sandbox en production échouerait à l'authentification, mais
  // seulement au premier paiement : on refuse tôt, au démarrage ou au premier
  // appel, plutôt que de laisser croire que le checkout fonctionne.
  if (env.NODE_ENV === 'production' && environment === 'sandbox') {
    throw new Hub2ConfigError(
      'HUB2_SANDBOX_IN_PRODUCTION',
      'HUB2_ENV=sandbox est interdit en production : utilisez HUB2_ENV=live.',
    );
  }

  const webhookSecret = env.HUB2_WEBHOOK_SECRET?.trim();

  return {
    baseUrl: (env.HUB2_BASE_URL?.trim() || 'https://api.hub2.io').replace(/\/+$/, ''),
    apiKey,
    merchantId,
    environment,
    webhookSecret: webhookSecret || null,
    timeoutMs: parseInteger(env.HUB2_TIMEOUT_MS, 15_000, 1_000, 60_000),
    paymentLinkTtlMinutes: parseInteger(env.HUB2_PAYMENT_LINK_TTL_MINUTES, 30, 5, 120),
    applyEvents: env.PAYMENTS_APPLY_EVENTS === 'true',
  };
}
