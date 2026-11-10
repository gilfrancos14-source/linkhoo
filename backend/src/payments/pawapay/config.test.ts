import { describe, expect, it } from 'vitest';
import { getPawapayConfig } from './config';

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PAWAPAY_API_KEY: 'api-key',
    PAWAPAY_MERCHANT_ID: 'merchant',
    ...overrides,
  };
}

describe('getPawapayConfig', () => {
  it('suit PAWAPAY_ENV pour l’URL par défaut', () => {
    expect(getPawapayConfig(env({ PAWAPAY_ENV: 'sandbox' })).baseUrl).toBe(
      'https://api.sandbox.pawapay.io',
    );
    expect(getPawapayConfig(env({ PAWAPAY_ENV: 'live' })).baseUrl).toBe(
      'https://api.pawapay.io',
    );
  });

  it('exige l’API key ET le merchant id', () => {
    expect(() => getPawapayConfig(env({ PAWAPAY_MERCHANT_ID: '' }))).toThrowError(
      /PAWAPAY_MERCHANT_ID/,
    );
  });

  it('force la vérification des callbacks en production', () => {
    const config = getPawapayConfig(
      env({
        NODE_ENV: 'production',
        PAWAPAY_ENV: 'live',
        PAWAPAY_VERIFY_CALLBACKS: 'false',
      }),
    );
    expect(config.verifyCallbacks).toBe(true);
  });

  it('désactive la vérification par défaut en dev, activable explicitement', () => {
    expect(getPawapayConfig(env()).verifyCallbacks).toBe(false);
    expect(
      getPawapayConfig(env({ PAWAPAY_VERIFY_CALLBACKS: 'true' })).verifyCallbacks,
    ).toBe(true);
  });

  it('refuse le sandbox en production (env ou URL explicite)', () => {
    expect(() =>
      getPawapayConfig(env({ NODE_ENV: 'production', PAWAPAY_ENV: 'sandbox' })),
    ).toThrowError(/sandbox est interdit/);

    expect(() =>
      getPawapayConfig(
        env({
          NODE_ENV: 'production',
          PAWAPAY_ENV: 'live',
          PAWAPAY_BASE_URL: 'https://api.sandbox.pawapay.io',
        }),
      ),
    ).toThrowError(/sandbox/);
  });
});
