import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { Transaction, Webhook } from 'fedapay';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const app = buildTestApp('/api/premium', premiumRouter, { captureRawBody: true });

const FUTURE = '2099-01-01T00:00:00Z';

let gerants: FakeChain;
let transactions: FakeChain;

function stubTables(tables: Partial<{ gerants: FakeChain | FakeChain[]; premium_transactions: FakeChain | FakeChain[] }> = {}): void {
  useSupabaseTables(supabaseAdmin.from, {
    gerants,
    premium_transactions: transactions,
    ...tables,
  });
}

const activeGerant = {
  id: 'g1',
  clerk_user_id: 'user_1',
  email: 'gerant@example.ci',
  market: 'CI',
  is_premium: false,
  premium_expires_at: null,
};

function approvedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 99,
    amount: 5000,
    status: 'approved',
    customer: { email: 'gerant@example.ci' },
    metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'premium' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  process.env.FEDAPAY_WEBHOOK_SECRET = 'secret-webhook';
  gerants = fakeChain({ data: activeGerant, error: null });
  transactions = fakeChain({ data: { id: 'pt-1', status: 'pending', activated_at: null }, error: null });
  stubTables();
});

describe('POST /api/premium/initiate', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/premium/initiate').send({ market: 'CI' });
    expect(res.status).toBe(401);
  });

  it('400 sur un market inconnu', async () => {
    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'XX' });
    expect(res.status).toBe(400);
  });

  it('400 si un champ inconnu est envoyé (strict)', async () => {
    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI', amount: 1000 });
    expect(res.status).toBe(400);
  });

  it('404 si le gérant nexiste pas', async () => {
    gerants = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI' });
    expect(res.status).toBe(404);
  });

  it('400 si labonnement est déjà actif', async () => {
    gerants = fakeChain({
      data: { ...activeGerant, is_premium: true, premium_expires_at: FUTURE },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Vous êtes déjà premium');
    expect(res.body.expires_at).toBe(FUTURE);
  });

  it('400 si un premium actif existe déjà sur un autre marché', async () => {
    const firstFetch = fakeChain({ data: { ...activeGerant, market: 'CI' }, error: null });
    const otherMarket = fakeChain({
      data: { market: 'CI', is_premium: true, premium_expires_at: FUTURE },
      error: null,
    });
    stubTables({ gerants: [firstFetch, otherMarket] });

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'BJ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('un autre marché');
  });

  it('400 si lemail du gérant est manquant', async () => {
    gerants = fakeChain({ data: { ...activeGerant, email: null }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send({ market: 'CI' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Email gérant invalide ou manquant');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('200 : crée la transaction et enregistre la ligne en attente', async () => {
    const persisted = fakeChain({
      data: { id: 'pt-1', status: 'pending', activated_at: null },
      error: null,
    });
    stubTables({ premium_transactions: persisted });
    vi.mocked(Transaction.create).mockResolvedValue({
      id: 77,
      generateToken: async () => ({ url: 'https://process.fedapay.com/page-77' }),
    } as never);

    const res = await request(app)
      .post('/api/premium/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .set('Origin', 'http://localhost:5173')
      .send({ market: 'CI' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      transaction_id: 77,
      payment_url: 'https://process.fedapay.com/page-77',
    });
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        callback_url: 'http://localhost:5173/ci/gerant/premium/success',
        metadata: expect.objectContaining({ clerk_user_id: 'user_1', type: 'premium' }),
      }),
    );
    expect(persisted.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ fedapay_transaction_id: 77, status: 'pending', type: 'premium' }),
      { onConflict: 'fedapay_transaction_id' },
    );
  });
});

describe('POST /api/premium/confirm', () => {
  it('400 sur un transaction_id invalide', async () => {
    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 0 });
    expect(res.status).toBe(400);
  });

  it('404 si FedaPay ne connaît pas la transaction', async () => {
    vi.mocked(Transaction.retrieve).mockRejectedValue(
      Object.assign(new Error('Transaction not found'), { status: 404 }),
    );

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });
    expect(res.status).toBe(404);
  });

  it('400 si les métadonnées sont incomplètes', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(
      approvedTransaction({ metadata: { market: 'CI' } }) as never,
    );

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Métadonnées de transaction invalides');
  });

  it('403 si la transaction appartient à un autre gérant', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(
      approvedTransaction({ metadata: { clerk_user_id: 'user_2', market: 'CI', type: 'premium' } }) as never,
    );

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });
    expect(res.status).toBe(403);
  });

  it('400 si la transaction concerne une vérification', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(
      approvedTransaction({ metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'verification' } }) as never,
    );

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('non éligible');
  });

  it('400 si le montant est insuffisant', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(approvedTransaction({ amount: 100 }) as never);

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Montant de transaction insuffisant');
  });

  it('400 si le paiement est encore en attente', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(approvedTransaction({ status: 'pending' }) as never);

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('pending');
    expect(transactions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      { onConflict: 'fedapay_transaction_id' },
    );
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('200 : confirme et active labonnement', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(approvedTransaction() as never);
    const activated = fakeChain({
      data: { id: 'pt-1', status: 'approved', activated_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    stubTables({ premium_transactions: activated });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ already_activated: false, new_expires_at: FUTURE }],
    } as never);

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.already_active).toBe(false);
    expect(res.body.premium_expires_at).toBe(FUTURE);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('activate_premium_checked', {
      p_transaction_id: 'pt-1',
      p_days: 30,
    });
  });

  it('200 : renvoie déjà actif si le webhook a consommé la transaction', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(approvedTransaction() as never);
    const activated = fakeChain({
      data: { id: 'pt-1', status: 'approved', activated_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    stubTables({ premium_transactions: activated });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ already_activated: true, new_expires_at: FUTURE }],
    } as never);

    const res = await request(app)
      .post('/api/premium/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 12 });

    expect(res.status).toBe(200);
    expect(res.body.already_active).toBe(true);
  });
});

describe('POST /api/premium/webhook', () => {
  it('500 si le secret de webhook nest pas configuré', async () => {
    delete process.env.FEDAPAY_WEBHOOK_SECRET;

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(500);
    expect(res.text).toBe('Webhook non configuré');
  });

  it('400 si la signature nest pas valide', async () => {
    vi.mocked(Webhook.constructEvent).mockImplementation(() => {
      throw new Error('signature non conforme');
    });

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'mauvaise')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(400);
    expect(res.text).toContain('signature non conforme');
    expect(Webhook.constructEvent).toHaveBeenCalledWith(
      expect.any(String),
      'mauvaise',
      'secret-webhook',
    );
  });

  it('200 : ignore un événement sans métadonnées exploitables', async () => {
    vi.mocked(Webhook.constructEvent).mockReturnValue({
      name: 'transaction.approved',
      entity: { id: 5, amount: 5000, status: 'approved', metadata: {} },
    } as never);

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: 'invalid_metadata' });
    expect(transactions.upsert).not.toHaveBeenCalled();
  });

  it('200 : active le premium sur un paiement approuvé', async () => {
    vi.mocked(Webhook.constructEvent).mockReturnValue({
      name: 'transaction.approved',
      entity: {
        id: 4242,
        amount: 5000,
        status: 'approved',
        customer: { email: 'gerant@example.ci' },
        metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'premium' },
      },
    } as never);
    const activated = fakeChain({
      data: { id: 'pt-1', status: 'approved', activated_at: null },
      error: null,
    });
    stubTables({ premium_transactions: activated });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ already_activated: false, new_expires_at: FUTURE }],
    } as never);

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('activate_premium_checked', {
      p_transaction_id: 'pt-1',
      p_days: 30,
    });
  });

  it('200 : nactive pas un montant insuffisant', async () => {
    vi.mocked(Webhook.constructEvent).mockReturnValue({
      name: 'transaction.approved',
      entity: {
        id: 4243,
        amount: 100,
        status: 'approved',
        metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'premium' },
      },
    } as never);
    const pendingRow = fakeChain({
      data: { id: 'pt-1', status: 'approved', activated_at: null },
      error: null,
    });
    stubTables({ premium_transactions: pendingRow });

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    expect(pendingRow.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100, status: 'approved' }),
      { onConflict: 'fedapay_transaction_id' },
    );
  });

  it('200 : enregistre un paiement refusé sans activation', async () => {
    vi.mocked(Webhook.constructEvent).mockReturnValue({
      name: 'transaction.declined',
      entity: {
        id: 4244,
        amount: 5000,
        status: 'declined',
        metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'premium' },
      },
    } as never);
    const declined = fakeChain({
      data: { id: 'pt-1', status: 'declined', activated_at: null },
      error: null,
    });
    stubTables({ premium_transactions: declined });

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'transaction.declined' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(declined.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'declined' }),
      { onConflict: 'fedapay_transaction_id' },
    );
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('200 : ignore un événement inconnu', async () => {
    vi.mocked(Webhook.constructEvent).mockReturnValue({
      name: 'payment.created',
      entity: { id: 1 },
    } as never);

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'payment.created' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(transactions.upsert).not.toHaveBeenCalled();
  });

  it('500 si le traitement de l’événement échoue', async () => {
    vi.mocked(Webhook.constructEvent).mockReturnValue({
      name: 'transaction.approved',
      entity: {
        id: 4245,
        amount: 5000,
        status: 'approved',
        metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'premium' },
      },
    } as never);
    transactions = fakeChain({ data: null, error: null });
    stubTables({ premium_transactions: transactions });

    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'sig')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur traitement webhook');
  });
});

describe('GET /api/premium/status', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/premium/status');
    expect(res.status).toBe(401);
  });

  it('404 si le gérant nexiste pas', async () => {
    gerants = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/premium/status')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('200 : premium actif et paiement en attente', async () => {
    gerants = fakeChain({
      data: { is_premium: true, premium_expires_at: FUTURE },
      error: null,
    });
    const pending = fakeChain({ data: { id: 'pt-1', created_at: '2026-01-01' }, error: null });
    stubTables({ premium_transactions: pending });

    const res = await request(app)
      .get('/api/premium/status')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      is_premium: true,
      premium_expires_at: FUTURE,
      has_pending_payment: true,
      pending_since: '2026-01-01',
    });
    expect(gerants.update).not.toHaveBeenCalled();
  });

  it('200 : labonnement expiré est désactivé', async () => {
    const expired = fakeChain({
      data: { is_premium: true, premium_expires_at: '2020-01-01T00:00:00Z' },
      error: null,
    });
    const noPending = fakeChain({ data: null, error: null });
    stubTables({ gerants: expired, premium_transactions: noPending });

    const res = await request(app)
      .get('/api/premium/status')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.is_premium).toBe(false);
    expect(res.body.has_pending_payment).toBe(false);
    expect(expired.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_premium: false }),
    );
  });
});
