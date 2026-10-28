import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import {
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../../testHelpers/supertestApp';
import { PaymentServiceError } from '../errors';
import { Hub2Error } from '../hub2/client';
import {
  buildPaymentReference,
  buildPublicUrl,
  createCheckout,
  resolveFxRate,
  type CreateCheckoutInput,
} from './checkout';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const HUB2_ENV: Record<string, string> = {
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
  APP_PUBLIC_URL: 'https://app.linkhoo.test',
};

const LINK_BODY = {
  id: 'link_1',
  url: 'https://pay.hub2.io/link_1',
  status: 'active',
  expirationDate: '2026-10-27T11:00:00.000Z',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...HUB2_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function stubFetch(
  body: unknown = LINK_BODY,
  init: { ok?: boolean; status?: number } = {},
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  }));
  vi.stubGlobal('fetch', mock);
  return mock;
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

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(HUB2_ENV)) delete process.env[key];
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
    await expect(resolveFxRate('XOF')).resolves.toBe(1);
    expect(fx.select).not.toHaveBeenCalled();
  });

  it('lit le dernier taux disponible', async () => {
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      fx_rates: fakeChain({ data: { rate: '1.2' }, error: null }),
    });
    await expect(resolveFxRate('XAF')).resolves.toBe(1.2);
  });

  it('refuse le paiement sans taux', async () => {
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      fx_rates: fakeChain({ data: null, error: null }),
    });
    await expect(resolveFxRate('GNF')).rejects.toMatchObject({
      code: 'FX_RATE_MISSING',
      status: 422,
    });
  });
});

describe('createCheckout', () => {
  it('crée le paiement, le lien, puis enregistre checkout_url', async () => {
    const insert = fakeChain({ data: { id: 'pay-1' }, error: null });
    const update = fakeChain({ data: null, error: null });
    stubPayments(insert, update);
    const fetchMock = stubFetch();

    const session = await createCheckout(input());

    expect(session).toMatchObject({
      checkoutUrl: LINK_BODY.url,
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
        provider: 'hub2',
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.hub2.io/payment-links');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      purchaseReference: session.reference,
      amount: 5_000,
      currency: 'XOF',
      country: 'CI',
      successUrl: `https://app.linkhoo.test/ci/gerant/premium/success?reference=${session.reference}`,
      failureUrl: `https://app.linkhoo.test/ci/gerant/premium?reference=${session.reference}`,
    });

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_payment_link_id: 'link_1',
        checkout_url: LINK_BODY.url,
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
    stubFetch();

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

  it('réutilise un checkout encore valide sans appeler Hub2', async () => {
    const reusable = {
      reference: 'PAY-2026-REUSE123456',
      checkout_url: 'https://pay.hub2.io/reuse',
      amount: 5_000,
      currency: 'XOF',
      amount_xof: 5_000,
      fx_rate: 1,
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: fakeChain({ data: reusable, error: null }),
    });
    const fetchMock = stubFetch();

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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('réutilise le checkout d’une réservation, filtré par reservation_id', async () => {
    const reusable = {
      reference: 'PAY-2026-RESA12345678',
      checkout_url: 'https://pay.hub2.io/resa',
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
    const fetchMock = stubFetch();

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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un marché sans opérateur Hub2', async () => {
    const fetchMock = stubFetch();
    await expect(createCheckout(input({ market: 'NE' }))).rejects.toMatchObject({
      code: 'ONLINE_PAYMENT_DISABLED',
      status: 422,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un montant nul ou non entier', async () => {
    await expect(createCheckout(input({ amountXof: 0 }))).rejects.toMatchObject({
      code: 'PAYMENT_CREATE_FAILED',
    });
    await expect(createCheckout(input({ amountXof: 10.5 }))).rejects.toMatchObject({
      code: 'PAYMENT_CREATE_FAILED',
    });
  });

  it('marque le paiement en échec quand Hub2 refuse le lien', async () => {
    const insert = fakeChain({ data: { id: 'pay-3' }, error: null });
    const update = fakeChain({ data: null, error: null });
    stubPayments(insert, update);
    stubFetch({ message: 'Opérateur indisponible', code: 'PROVIDER_DOWN' }, { ok: false, status: 400 });

    await expect(createCheckout(input())).rejects.toBeInstanceOf(Hub2Error);
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure_code: 'PROVIDER_DOWN',
        failure_message: 'Opérateur indisponible',
      }),
    );
  });

  it('échoue si la ligne de paiement ne peut pas être créée', async () => {
    const insert = fakeChain({ data: null, error: { message: 'insert refusé' } });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: insert,
    });
    const fetchMock = stubFetch();

    await expect(createCheckout(input())).rejects.toMatchObject({
      code: 'PAYMENT_CREATE_FAILED',
      status: 500,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
