import { describe, expect, it } from 'vitest';
import { MARKET_CODES } from '../config/markets';
import {
  HUB2_MARKETS,
  Hub2ConfigError,
  MIN_AMOUNT_BY_CURRENCY,
  getHub2Config,
  getMarketPaymentConfig,
  isMarketSupported,
  supportedMarkets,
} from './config';

const BASE_ENV = {
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
} as NodeJS.ProcessEnv;

describe('couverture des marchés', () => {
  it('décrit les 12 marchés, sans trou', () => {
    expect(Object.keys(HUB2_MARKETS).sort()).toEqual([...MARKET_CODES].sort());
  });

  it('ouvre le paiement en ligne partout où un opérateur existe', () => {
    expect(supportedMarkets()).toEqual([
      'CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML',
    ]);
  });

  it('laisse NE et CD fermés : Hub2 n’expose aucun opérateur', () => {
    for (const market of ['NE', 'CD'] as const) {
      expect(isMarketSupported(market)).toBe(false);
      expect(getMarketPaymentConfig(market).providers).toEqual([]);
      expect(getMarketPaymentConfig(market).methods).toEqual([]);
    }
  });

  it('utilise la devise réellement débitée par Hub2', () => {
    expect(getMarketPaymentConfig('CI').currency).toBe('XOF');
    expect(getMarketPaymentConfig('CM').currency).toBe('XAF');
    expect(getMarketPaymentConfig('CG').currency).toBe('XAF');
    expect(getMarketPaymentConfig('GA').currency).toBe('XAF');
    expect(getMarketPaymentConfig('GN').currency).toBe('GNF');
  });

  it('ne déclare que des opérateurs en minuscules', () => {
    for (const market of MARKET_CODES) {
      for (const provider of HUB2_MARKETS[market].providers) {
        expect(provider).toBe(provider.toLowerCase());
      }
    }
  });

  it('applique le minimum Hub2 de 500 en XOF et XAF', () => {
    expect(MIN_AMOUNT_BY_CURRENCY.XOF).toBe(500);
    expect(MIN_AMOUNT_BY_CURRENCY.XAF).toBe(500);
    expect(MIN_AMOUNT_BY_CURRENCY.GNF).toBeGreaterThan(0);
  });
});

describe('getHub2Config', () => {
  it('lit les secrets et applique les valeurs par défaut', () => {
    const config = getHub2Config(BASE_ENV);
    expect(config).toMatchObject({
      baseUrl: 'https://api.hub2.io',
      apiKey: 'sk_test_123',
      merchantId: 'merchant_123',
      environment: 'sandbox',
      webhookSecret: null,
      timeoutMs: 15_000,
      paymentLinkTtlMinutes: 30,
      applyEvents: false,
    });
  });

  it('accepte une base URL personnalisée sans slash final', () => {
    expect(getHub2Config({ ...BASE_ENV, HUB2_BASE_URL: 'https://proxy.test/' }).baseUrl)
      .toBe('https://proxy.test');
  });

  it('normalise live/production', () => {
    expect(getHub2Config({ ...BASE_ENV, HUB2_ENV: 'LIVE' }).environment).toBe('live');
    expect(getHub2Config({ ...BASE_ENV, HUB2_ENV: 'production' }).environment).toBe('live');
  });

  it('refuse une valeur d’environnement inconnue', () => {
    expect(() => getHub2Config({ ...BASE_ENV, HUB2_ENV: 'staging' }))
      .toThrowError(Hub2ConfigError);
  });

  it('refuse de démarrer sans clé ou sans marchand', () => {
    expect(() => getHub2Config({ ...BASE_ENV, HUB2_API_KEY: '' })).toThrowError(/HUB2_API_KEY/);
    expect(() => getHub2Config({ ...BASE_ENV, HUB2_MERCHANT_ID: '  ' })).toThrowError(/HUB2_MERCHANT_ID/);
  });

  it('interdit le sandbox en production', () => {
    expect(() => getHub2Config({ ...BASE_ENV, NODE_ENV: 'production' })).toThrowError(
      /sandbox est interdit en production/,
    );
    expect(
      getHub2Config({ ...BASE_ENV, NODE_ENV: 'production', HUB2_ENV: 'live' }).environment,
    ).toBe('live');
  });

  it('borne les réglages numériques et ignore une valeur aberrante', () => {
    expect(getHub2Config({ ...BASE_ENV, HUB2_TIMEOUT_MS: '2500' }).timeoutMs).toBe(2500);
    expect(getHub2Config({ ...BASE_ENV, HUB2_TIMEOUT_MS: '999999' }).timeoutMs).toBe(15_000);
    expect(getHub2Config({ ...BASE_ENV, HUB2_PAYMENT_LINK_TTL_MINUTES: '2' }).paymentLinkTtlMinutes).toBe(30);
  });

  it('active le traitement métier uniquement sur true explicite', () => {
    expect(getHub2Config({ ...BASE_ENV, PAYMENTS_APPLY_EVENTS: 'true' }).applyEvents).toBe(true);
    expect(getHub2Config({ ...BASE_ENV, PAYMENTS_APPLY_EVENTS: '1' }).applyEvents).toBe(false);
  });
});
