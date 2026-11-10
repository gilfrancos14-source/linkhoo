import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import {
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../../testHelpers/supertestApp';
import { PaymentServiceError } from '../errors';
import { PawapayApiError } from '../pawapay/client';
import { createPawapayCheckout, resolveFxRate } from '../pawapay/checkouts';
import {
  buildPaymentReference,
  buildPublicUrl,
  createCheckout,
  type CreateCheckoutInput,
} from './checkout';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../pawapay/checkouts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pawapay/checkouts')>();
  return { ...actual, createPawapayCheckout: vi.fn() };
});

const PAWAPAY_ENV: Record<string, string> = {
  PAYMENTS_PROVIDER: 'pawapay',
  PAWAPAY_API_KEY: 'pawapay_api_key_test',
  PAWAPAY_MERCHANT_ID: 'pawapay_merchant_test',
  PAWAPAY_ENV: 'sandbox',
  APP_PUBLIC_URL: 'https://app.linkhoo.test',
};

const CHECKOUT_URL = 'https://checkout.pawapay.io/pay-1';

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...PAWAPAY_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function input(overrides: Partial<CreateCheckoutInput> = {}): CreateCheckoutInput {
  return {
    purpose: 'premium',
    market: 'CI',
    amountXof: 5_000,
    payerType: 'gerant',
    payerClerkUserId: 'user_1',
    gerantClerkUserId: 'user_1',
    description: 'Abonnement Premium CI - 30 jours',
    returnPath: '/ci/gerant/premium/success',
    failurePath: '/ci/gerant/premium',
    ...overrides,
  };
}

function stubPayments(insert: FakeChain, update: FakeChain): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    payments: [insert, update],
  });
}

function mockPawapayCheckout(): void {
  vi.mocked(createPawapayCheckout).mockImplementation(async (checkoutInput) => {
    const currency = checkoutInput.market === 'CM' ? 'XAF' : 'XOF';
    const fxRate = currency === 'XOF' ? 1 : 1.2;
    return {
      reference: checkoutInput.reference,
      checkoutUrl: CHECKOUT_URL,
      redirectUrl: CHECKOUT_URL,
      checkoutId: 'checkout-1',
      amount: Math.round(checkoutInput.amountXof * fxRate),
      currency,
      amountXof: checkoutInput.amountXof,
      fxRate,
      expiresAt: '2026-10-27T11:00:00.000Z',
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
  mockPawapayCheckout();
});

afterEach(() => {
  for (const key of Object.keys(PAWAPAY_ENV)) delete process.env[key];
});

describe('buildPaymentReference', () => {
  it('respecte le format attendu par la base', () => {
    expect(buildPaymentReference(new Date('2026-10-27T10:00:00Z'))).toMatch(
      /^PAY-2026-[A-F0-9]{12}$/,
    );
  });

  it('ne réutilise pas la même référence', () => {
    expect(buildPaymentReference()).not.toBe(buildPaymentReference());
  });
});

describe('buildPublicUrl', () => {
  it('préfixe APP_PUBLIC_URL sans double slash', () => {
    process.env.APP_PUBLIC_URL = 'https://app.linkhoo.test/';
    expect(buildPublicUrl('/ci/gerant/premium/success')).toBe(
      'https://app.linkhoo.test/ci/gerant/premium/success',
    );
  });

  it('refuse un chemin relatif ou protocol-relative', () => {
    expect(() => buildPublicUrl('ci/premium')).toThrow(PaymentServiceError);
    expect(() => buildPublicUrl('//evil.example/pay')).toThrow(PaymentServiceError);
  });
});

describe('resolveFxRate', () => {
  it('renvoie 1 pour XOF sans interroger la base', async () => {
    const fx = fakeChain({ data: null, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      fx_rates: fx,
    });
    await expect(resolveFxRate('CI', 'XOF')).resolves.toBe(1);
    expect(fx.select).not.toHaveBeenCalled();
  });

  it('lit le dernier taux disponible', async () => {
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      fx_rates: fakeChain({ data: { rate: '1.2' }, error: null }),
    });
    await expect(resolveFxRate('CM', 'XAF')).resolves.toBe(1.2);
  });

  it('refuse le paiement sans taux', async () => {
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      fx_rates: fakeChain({ data: null, error: null }),
    });
    await expect(resolveFxRate('GN', 'GNF')).rejects.toMatchObject({
      code: 'FX_RATE_MISSING',
    });
  });
});

describe('createCheckout', () => {
  it('crée le paiement, le checkout pawaPay, puis enregistre checkout_url', async () => {
    const insert = fakeChain({ data: { id: 'pay-1' }, error: null });
    const update = fakeChain({ data: null, error: null });
    stubPayments(insert, update);

    const session = await createCheckout(input());

    expect(session).toMatchObject({
      checkoutUrl: CHECKOUT_URL,
      redirectUrl: CHECKOUT_URL,
      checkoutId: 'checkout-1',
      amount: 5_000,
      currency: 'XOF',
      amountXof: 5_000,
      fxRate: 1,
    });
    expect(session.reference).toMatch(/^PAY-2026-[A-F0-9]{12}$/);

    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: session.reference,
        purpose: 'premium',
        provider: 'pawapay',
        payer_type: 'gerant',
        payer_clerk_user_id: 'user_1',
        gerant_clerk_user_id: 'user_1',
        market: 'CI',
        amount: 5_000,
        currency: 'XOF',
        amount_xof: 5_000,
        fx_rate: 1,
        status: 'created',
        metadata: expect.objectContaining({
          return_path: '/ci/gerant/premium/success',
          failure_path: '/ci/gerant/premium',
        }),
      }),
    );

    expect(createPawapayCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-1',
        reference: session.reference,
        market: 'CI',
        amountXof: 5_000,
        returnPath: '/ci/gerant/premium/success',
        failurePath: '/ci/gerant/premium',
      }),
    );

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pawapay_checkout_id: 'checkout-1',
        checkout_url: CHECKOUT_URL,
        status: 'pending',
      }),
    );
  });

  it('convertit le prix XOF dans la devise du marché', async () => {
    const insert = fakeChain({ data: { id: 'pay-2' }, error: null });
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: [insert, update],
      fx_rates: fakeChain({ data: { rate: '1.2' }, error: null }),
    });

    const session = await createCheckout(
      input({ market: 'CM', amountXof: 5_000, returnPath: '/cm/gerant/premium/success' }),
    );

    expect(session.currency).toBe('XAF');
    expect(session.amount).toBe(6_000);
    expect(session.fxRate).toBe(1.2);
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6_000, currency: 'XAF', amount_xof: 5_000 }),
    );
  });

  it('réutilise un checkout encore valide sans appeler pawaPay', async () => {
    const reusable = {
      reference: 'PAY-2026-REUSE123456',
      checkout_url: 'https://checkout.pawapay.io/reuse',
      amount: 5_000,
      currency: 'XOF',
      amount_xof: 5_000,
      fx_rate: 1,
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: fakeChain({ data: reusable, error: null }),
    });

    const session = await createCheckout(input({ reusePendingPayment: true }));

    expect(session).toEqual({
      reference: reusable.reference,
      checkoutUrl: reusable.checkout_url,
      amount: 5_000,
      currency: 'XOF',
      amountXof: 5_000,
      fxRate: 1,
      expiresAt: reusable.expires_at,
    });
    expect(createPawapayCheckout).not.toHaveBeenCalled();
  });

  it('réutilise le checkout d’une réservation, filtré par reservation_id', async () => {
    const reusable = {
      reference: 'PAY-2026-RESA12345678',
      checkout_url: 'https://checkout.pawapay.io/resa',
      amount: 150_000,
      currency: 'XOF',
      amount_xof: 150_000,
      fx_rate: 1,
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    const chain = fakeChain({ data: reusable, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: chain,
    });

    const session = await createCheckout(
      input({
        purpose: 'booking',
        reusePendingPayment: true,
        reservationId: 'resa-1',
      }),
    );

    expect(chain.eq).toHaveBeenCalledWith('reservation_id', 'resa-1');
    expect(chain.eq).not.toHaveBeenCalledWith('gerant_clerk_user_id', expect.anything());
    expect(session.reference).toBe(reusable.reference);
    expect(createPawapayCheckout).not.toHaveBeenCalled();
  });

  it('refuse un marché sans opérateur pawaPay', async () => {
    await expect(createCheckout(input({ market: 'NE' }))).rejects.toMatchObject({
      code: 'ONLINE_PAYMENT_DISABLED',
      status: 422,
    });
    expect(createPawapayCheckout).not.toHaveBeenCalled();
  });

  it('refuse un montant nul ou non entier', async () => {
    await expect(createCheckout(input({ amountXof: 0 }))).rejects.toMatchObject({
      code: 'PAYMENT_CREATE_FAILED',
    });
    await expect(createCheckout(input({ amountXof: 10.5 }))).rejects.toMatchObject({
      code: 'PAYMENT_CREATE_FAILED',
    });
  });

  it('marque le paiement en échec quand pawaPay refuse le checkout', async () => {
    const insert = fakeChain({ data: { id: 'pay-3' }, error: null });
    const update = fakeChain({ data: null, error: null });
    stubPayments(insert, update);
    vi.mocked(createPawapayCheckout).mockRejectedValue(
      new PawapayApiError('Opérateur indisponible', 400),
    );

    await expect(createCheckout(input())).rejects.toBeInstanceOf(PawapayApiError);
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure_code: 'PAWAPAY_ERROR',
        failure_message: 'Opérateur indisponible',
      }),
    );
  });

  it('échoue si la ligne de paiement ne peut pas être créée', async () => {
    const insert = fakeChain({ data: null, error: { message: 'insert refusé' } });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: insert,
    });

    await expect(createCheckout(input())).rejects.toMatchObject({
      code: 'PAYMENT_CREATE_FAILED',
      status: 500,
    });
    expect(createPawapayCheckout).not.toHaveBeenCalled();
  });
});
