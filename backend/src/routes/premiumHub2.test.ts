import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import premiumRouter from './premium';
import { supabaseAdmin } from '../config/supabase';
import {
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

vi.mock('fedapay', () => ({
  FedaPay: { setApiKey: vi.fn(), setEnvironment: vi.fn(), setAccountId: vi.fn() },
  Transaction: { create: vi.fn(), retrieve: vi.fn() },
  Webhook: { constructEvent: vi.fn() },
}));

const app = buildTestApp('/api/premium', premiumRouter);

const ENV: Record<string, string> = {
  PAYMENTS_PROVIDER: 'hub2',
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
  APP_PUBLIC_URL: 'https://app.linkhoo.test',
};

const GERANT = {
  id: 'g1',
  clerk_user_id: 'user_1',
  email: 'gerant@example.ci',
  market: 'CI',
  is_premium: false,
  premium_expires_at: null,
};

const PAYMENT = {
  id: 'pay-1',
  reference: 'PAY-2026-ABC123',
  purpose: 'premium',
  status: 'pending',
  amount: 5_000,
  currency: 'XOF',
  amount_xof: 5_000,
  gerant_clerk_user_id: 'user_1',
  fulfilled_at: null,
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

function stubTables(tables: Record<string, FakeChain | FakeChain[]> = {}): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    gerants: fakeChain({ data: GERANT, error: null }),
    ...tables,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  setEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(ENV)) delete process.env[key];
});

describe('POST /api/premium/initiate (Hub2)', () => {
  it('renvoie une référence et l’URL du checkout hébergé', async () => {
    stubTables({
      payments: [
        fakeChain({ data: null, error: null }),
        fakeChain({ data: { id: 'pay-1' }, error: null }),
        fakeChain({ data: null, error: null }),
      ],
    });
    stubFetch({
      id: 'link_1',
      url: 'https://pay.hub2.io/link_1',
      status: 'active',
      expirationDate: '2026-10-27T11:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      checkout_url: 'https://pay.hub2.io/link_1',
      amount: 5_000,
      currency: 'XOF',
      amount_xof: 5_000,
    });
    expect(res.body.reference).toMatch(/^PAY-2026-[A-F0-9]{12}$/);
  });

  it('503 quand Hub2 n’est pas configuré', async () => {
    setEnv({ HUB2_API_KEY: undefined });
    stubTables({
      payments: fakeChain({ data: null, error: null }),
    });

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI' });

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: 'Paiement indisponible', code: 'HUB2_NOT_CONFIGURED' });
  });

  it('502 quand Hub2 refuse la création du lien', async () => {
    stubTables({
      payments: [
        fakeChain({ data: null, error: null }),
        fakeChain({ data: { id: 'pay-1' }, error: null }),
        fakeChain({ data: null, error: null }),
      ],
    });
    stubFetch({ message: 'Opérateur indisponible', code: 'PROVIDER_DOWN' }, { ok: false, status: 400 });

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI' });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: 'PROVIDER_DOWN' });
  });
});

describe('POST /api/premium/confirm (Hub2)', () => {
  it('200 : active le premium depuis la référence', async () => {
    stubTables({ payments: fakeChain({ data: PAYMENT, error: null }) });
    stubFetch([{ id: 'pi_1', status: 'successful', purchaseReference: PAYMENT.reference }]);
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

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ reference: PAYMENT.reference });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      already_active: false,
      premium_expires_at: '2099-02-01T00:00:00.000Z',
      gerant: expect.objectContaining({ id: 'g1' }),
    });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', expect.objectContaining({
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pi_1',
    }));
  });

  it('400 tant que Hub2 n’a pas confirmé', async () => {
    stubTables({ payments: fakeChain({ data: PAYMENT, error: null }) });
    stubFetch([{ id: 'pi_1', status: 'processing', purchaseReference: PAYMENT.reference }]);

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ reference: PAYMENT.reference });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'PAYMENT_NOT_SUCCEEDED', status: 'pending' });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('400 si transaction_id est envoyé au lieu de reference', async () => {
    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('reference requise pour un paiement Hub2');
  });

  it('404 sur une référence inconnue', async () => {
    stubTables({ payments: fakeChain({ data: null, error: null }) });

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ reference: PAYMENT.reference });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
  });

  it('400 quand les deux identifiants sont envoyés', async () => {
    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 42, reference: PAYMENT.reference });

    expect(res.status).toBe(400);
  });
});
