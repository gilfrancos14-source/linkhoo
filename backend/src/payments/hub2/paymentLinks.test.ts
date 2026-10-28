import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hub2Config, PaymentLinkInput } from '../types';
import { Hub2Error } from './client';
import { buildPaymentLinkBody, createPaymentLink } from './paymentLinks';

const CONFIG: Hub2Config = {
  baseUrl: 'https://api.hub2.io',
  apiKey: 'sk_test_123',
  merchantId: 'merchant_123',
  environment: 'sandbox',
  webhookSecret: 'whsec_test_123',
  timeoutMs: 5_000,
  paymentLinkTtlMinutes: 30,
  applyEvents: false,
};

function input(overrides: Partial<PaymentLinkInput> = {}): PaymentLinkInput {
  return {
    reference: 'PAY-2026-ABC123',
    amount: 5_000,
    currency: 'XOF',
    market: 'CI',
    description: 'Abonnement Premium 30 jours',
    successUrl: 'https://app.linkhoo.com/ci/gerant/premium/success',
    failureUrl: 'https://app.linkhoo.com/ci/gerant/premium/echec',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
  };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('une erreur était attendue');
  } catch (error) {
    expect(error).toBeInstanceOf(Hub2Error);
    expect((error as Hub2Error).code).toBe(code);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildPaymentLinkBody', () => {
  it('construit le contrat Hub2 depuis la configuration du marché', () => {
    const payload = input();
    const body = buildPaymentLinkBody(payload);
    expect(body).toMatchObject({
      purchaseReference: 'PAY-2026-ABC123',
      amount: 5_000,
      currency: 'XOF',
      country: 'CI',
      type: 'single_use',
      paymentMethods: ['mobile_money', 'credit_card', 'bank_transfer'],
      successUrl: 'https://app.linkhoo.com/ci/gerant/premium/success',
    });
    expect(body.providers).toContain('orange');
    expect(body.providers).toContain('wave');
    expect(body.expirationDate).toBe(payload.expiresAt.toISOString());
  });

  it('utilise la devise locale du marché', () => {
    const body = buildPaymentLinkBody(input({ market: 'CM', currency: 'XAF' }));
    expect(body.currency).toBe('XAF');
    expect(body.providers).toEqual(['orange', 'mtn']);
  });

  it('ajoute le numéro verrouillé quand il est fourni', () => {
    const body = buildPaymentLinkBody(input({ customerPhoneNumber: '+2250700000000' }));
    expect(body.customerPhoneNumber).toBe('+2250700000000');
    expect(buildPaymentLinkBody(input()).customerPhoneNumber).toBeUndefined();
  });

  it('refuse une référence hors format', () => {
    expectCode(() => buildPaymentLinkBody(input({ reference: 'ORDER-1' })), 'PAYMENT_LINK_INVALID_REFERENCE');
  });

  it('refuse un marché non couvert', () => {
    expectCode(() => buildPaymentLinkBody(input({ market: 'NE' })), 'MARKET_NOT_SUPPORTED');
  });

  it('refuse une devise incohérente avec le marché', () => {
    expectCode(
      () => buildPaymentLinkBody(input({ market: 'CM', currency: 'XOF' })),
      'PAYMENT_LINK_CURRENCY_MISMATCH',
    );
  });

  it('applique le minimum Hub2', () => {
    expectCode(() => buildPaymentLinkBody(input({ amount: 499 })), 'PAYMENT_LINK_AMOUNT_TOO_LOW');
    expectCode(() => buildPaymentLinkBody(input({ amount: 500.5 })), 'PAYMENT_LINK_INVALID_AMOUNT');
    expectCode(() => buildPaymentLinkBody(input({ amount: 0 })), 'PAYMENT_LINK_INVALID_AMOUNT');
  });

  it('exige https, sauf en développement local', () => {
    expectCode(
      () => buildPaymentLinkBody(input({ successUrl: 'http://app.linkhoo.com/success' })),
      'PAYMENT_LINK_INSECURE_URL',
    );
    expectCode(
      () => buildPaymentLinkBody(input({ successUrl: 'pas-une-url' })),
      'PAYMENT_LINK_INVALID_URL',
    );
    expect(() =>
      buildPaymentLinkBody(input({ successUrl: 'http://localhost:5173/success' })),
    ).not.toThrow();
  });

  it('refuse une expiration passée', () => {
    expectCode(
      () => buildPaymentLinkBody(input({ expiresAt: new Date(Date.now() - 1_000) })),
      'PAYMENT_LINK_INVALID_EXPIRY',
    );
  });
});

describe('createPaymentLink', () => {
  it('appelle POST /payment-links avec les en-têtes Hub2', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'pl_123',
          url: 'https://pay.hub2.io/pl_123',
          status: 'active',
          expirationDate: '2026-10-27T12:30:00.000Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createPaymentLink(CONFIG, input());

    expect(result).toEqual({
      id: 'pl_123',
      url: 'https://pay.hub2.io/pl_123',
      status: 'active',
      expiresAt: '2026-10-27T12:30:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.hub2.io/payment-links');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.ApiKey).toBe('sk_test_123');
    expect(headers.MerchantId).toBe('merchant_123');
    expect(headers.Environment).toBe('sandbox');
    const sent = JSON.parse(String(init.body));
    expect(sent.purchaseReference).toBe('PAY-2026-ABC123');
    expect(sent.country).toBe('CI');
  });

  it('rejette une réponse Hub2 incomplète', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ status: 'active' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(createPaymentLink(CONFIG, input())).rejects.toMatchObject({
      code: 'HUB2_INVALID_RESPONSE',
    });
  });

  it('remonte l’erreur HTTP de Hub2', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'Invalid provider', code: 'PROVIDER_INVALID' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(createPaymentLink(CONFIG, input())).rejects.toMatchObject({
      status: 422,
      code: 'PROVIDER_INVALID',
      message: 'Invalid provider',
    });
  });
});
