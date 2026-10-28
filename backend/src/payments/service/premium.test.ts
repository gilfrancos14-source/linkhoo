import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import {
  fakeChain,
  useSupabaseTables,
} from '../../testHelpers/supertestApp';
import { confirmPremiumPayment, createPremiumCheckout } from './premium';

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

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...HUB2_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async () => response(body, init));
  vi.stubGlobal('fetch', mock);
  return mock;
}

function response(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  };
}

const PAYMENT = {
  id: 'pay-1',
  reference: 'PAY-2026-ABC123',
  purpose: 'premium',
  status: 'pending',
  amount: 5_000,
  currency: 'XOF',
  amount_xof: 5_000,
  gerant_clerk_user_id: 'user_1',
  provider_payment_link_id: null,
  fulfilled_at: null,
};

const GERANT = {
  id: 'g1',
  clerk_user_id: 'user_1',
  market: 'CI',
  is_premium: true,
  premium_expires_at: '2099-01-01T00:00:00.000Z',
};

function stubPaymentTables(payment: Record<string, unknown> | null, gerant: Record<string, unknown> | null = GERANT): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    payments: fakeChain({ data: payment, error: null }),
    gerants: fakeChain({ data: gerant, error: null }),
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

describe('createPremiumCheckout', () => {
  it('ouvre un checkout premium avec le bon chemin de retour', async () => {
    const insert = fakeChain({ data: { id: 'pay-1' }, error: null });
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payments: [fakeChain({ data: null, error: null }), insert, update],
    });
    const fetchMock = stubFetch({
      id: 'link_1',
      url: 'https://pay.hub2.io/link_1',
      status: 'active',
      expirationDate: '2026-10-27T11:00:00.000Z',
    });

    const session = await createPremiumCheckout({
      market: 'CI',
      clerkUserId: 'user_1',
      email: 'gerant@example.ci',
    });

    expect(session.amountXof).toBe(5_000);
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'premium',
        gerant_clerk_user_id: 'user_1',
        payer_clerk_user_id: 'user_1',
        metadata: expect.objectContaining({
          email: 'gerant@example.ci',
          return_path: '/ci/gerant/premium/success',
          failure_path: '/ci/gerant/premium',
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.successUrl).toBe(
      `https://app.linkhoo.test/ci/gerant/premium/success?reference=${session.reference}`,
    );
  });
});

describe('confirmPremiumPayment', () => {
  it('404 quand la référence est inconnue', async () => {
    stubPaymentTables(null);
    await expect(confirmPremiumPayment('PAY-2026-ABC123', 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      status: 404,
    });
  });

  it('403 quand le paiement appartient à un autre gérant', async () => {
    stubPaymentTables({ ...PAYMENT, gerant_clerk_user_id: 'user_2' });
    await expect(confirmPremiumPayment('PAY-2026-ABC123', 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_FORBIDDEN',
      status: 403,
    });
  });

  it('400 quand le paiement n’est pas un premium', async () => {
    stubPaymentTables({ ...PAYMENT, purpose: 'booking' });
    await expect(confirmPremiumPayment('PAY-2026-ABC123', 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_PREMIUM',
      status: 400,
    });
  });

  it('ne rappelle pas Hub2 quand le webhook a déjà livré l’abonnement', async () => {
    stubPaymentTables({ ...PAYMENT, status: 'succeeded', fulfilled_at: '2026-10-27T10:00:00.000Z' });
    const fetchMock = stubFetch([]);

    const result = await confirmPremiumPayment('PAY-2026-ABC123', 'user_1');

    expect(result).toMatchObject({
      alreadyActive: true,
      expiresAt: GERANT.premium_expires_at,
      gerant: expect.objectContaining({ id: 'g1' }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('refuse tant que Hub2 n’a pas confirmé', async () => {
    stubPaymentTables(PAYMENT);
    stubFetch([{ id: 'pi_1', status: 'processing', purchaseReference: PAYMENT.reference }]);

    await expect(confirmPremiumPayment(PAYMENT.reference, 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_SUCCEEDED',
      status: 400,
      details: { status: 'pending' },
    });
  });

  it('active l’abonnement quand Hub2 renvoie un paiement réussi', async () => {
    stubPaymentTables(PAYMENT);
    stubFetch([
      { id: 'pi_old', status: 'failed', purchaseReference: PAYMENT.reference, updatedAt: '2026-10-27T09:00:00Z' },
      {
        id: 'pi_new',
        status: 'successful',
        purchaseReference: PAYMENT.reference,
        updatedAt: '2026-10-27T10:00:00Z',
        amount: 5_000,
        currency: 'XOF',
        payments: [{ id: 'pay_new', status: 'successful' }],
      },
    ]);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          payment_id: 'pay-1',
          already_claimed: false,
          new_expires_at: '2099-02-01T00:00:00.000Z',
          gerant_clerk_user_id: 'user_1',
          market: 'CI',
        },
      ],
      error: null,
    } as never);

    const result = await confirmPremiumPayment(PAYMENT.reference, 'user_1');

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pay_new',
      p_amount: 5_000,
      p_currency: 'XOF',
      p_days: 30,
    });
    expect(result).toMatchObject({
      alreadyActive: false,
      expiresAt: '2099-02-01T00:00:00.000Z',
    });
  });

  it('retombe sur le Payment Link quand l’intent est introuvable', async () => {
    stubPaymentTables({ ...PAYMENT, provider_payment_link_id: 'pl_1' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          id: 'pl_1',
          status: 'completed',
          amount: 5_000,
          currency: 'XOF',
          currentSuccessCount: 1,
          paymentAttempts: [
            {
              id: 'pay_1',
              status: 'successful',
              amount: 5_000,
              currency: 'XOF',
              updatedAt: '2026-10-27T10:00:00.000Z',
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ already_claimed: false, new_expires_at: '2099-02-01T00:00:00.000Z' }],
      error: null,
    } as never);

    const result = await confirmPremiumPayment(PAYMENT.reference, 'user_1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/payment-links/pl_1');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pay_1',
      p_amount: 5_000,
      p_currency: 'XOF',
      p_days: 30,
    });
    expect(result.alreadyActive).toBe(false);
  });

  it('refuse quand le Payment Link n’est pas encore payé', async () => {
    stubPaymentTables({ ...PAYMENT, provider_payment_link_id: 'pl_1' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          id: 'pl_1',
          status: 'active',
          amount: 5_000,
          currency: 'XOF',
          currentSuccessCount: 0,
          paymentAttempts: [],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(confirmPremiumPayment(PAYMENT.reference, 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_SUCCEEDED',
      status: 400,
    });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('traduit un écart de montant en 409', async () => {
    stubPaymentTables(PAYMENT);
    stubFetch([{ id: 'pi_1', status: 'successful', purchaseReference: PAYMENT.reference }]);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_AMOUNT_MISMATCH' },
    } as never);

    await expect(confirmPremiumPayment(PAYMENT.reference, 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      status: 409,
    });
  });
});
