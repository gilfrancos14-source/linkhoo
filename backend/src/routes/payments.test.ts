import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import paymentsRouter from './payments';
import { supabaseAdmin } from '../config/supabase';
import {
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

const app = buildTestApp('/api/payments', paymentsRouter);

const PAYMENT = {
  reference: 'PAY-2026-ABC123',
  purpose: 'premium',
  status: 'succeeded',
  amount: 5_000,
  currency: 'XOF',
  amount_xof: 5_000,
  checkout_url: 'https://pay.hub2.io/link_1',
  expires_at: '2026-10-27T11:00:00.000Z',
  paid_at: '2026-10-27T10:05:00.000Z',
  fulfilled_at: '2026-10-27T10:05:00.000Z',
  failure_code: null,
  payer_clerk_user_id: 'user_1',
  gerant_clerk_user_id: 'user_1',
  created_at: '2026-10-27T10:00:00.000Z',
  updated_at: '2026-10-27T10:05:00.000Z',
};

function stubPayment(payment: Record<string, unknown> | null): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    payments: fakeChain({ data: payment, error: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
});

describe('GET /api/payments/:reference', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/payments/PAY-2026-ABC123');
    expect(res.status).toBe(401);
  });

  it('400 sur une référence mal formée', async () => {
    const res = await request(app)
      .get('/api/payments/not-a-reference')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Référence de paiement invalide');
  });

  it('404 quand la référence est inconnue', async () => {
    stubPayment(null);
    const res = await request(app)
      .get('/api/payments/PAY-2026-ABC123')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('404 quand le paiement appartient à quelqu’un d’autre', async () => {
    stubPayment({ ...PAYMENT, payer_clerk_user_id: 'user_2', gerant_clerk_user_id: 'user_2' });
    const res = await request(app)
      .get('/api/payments/PAY-2026-ABC123')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('200 pour le payeur, sans exposer les champs prestataire', async () => {
    stubPayment(PAYMENT);
    const res = await request(app)
      .get('/api/payments/PAY-2026-ABC123')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      reference: 'PAY-2026-ABC123',
      purpose: 'premium',
      status: 'succeeded',
      amount: 5_000,
      currency: 'XOF',
      amount_xof: 5_000,
      checkout_url: 'https://pay.hub2.io/link_1',
    });
    expect(res.body).not.toHaveProperty('provider_payment_id');
    expect(res.body).not.toHaveProperty('payer_clerk_user_id');
  });

  it('200 pour le gérant bénéficiaire', async () => {
    stubPayment({ ...PAYMENT, payer_clerk_user_id: 'user_client', gerant_clerk_user_id: 'user_1' });
    const res = await request(app)
      .get('/api/payments/PAY-2026-ABC123')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
  });
});
