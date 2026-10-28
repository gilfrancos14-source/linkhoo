import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import payoutsRouter from './payouts';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
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

const app = buildTestApp('/api/payouts', payoutsRouter, {
  middlewares: [requireClerkAuth],
});

const SETTINGS = {
  clerk_user_id: 'user_1',
  market: 'CI',
  payout_method: 'mobile_money',
  payout_phone: '+2250700000000',
  payout_provider: 'orange',
  payout_bank_code: null,
  payout_bank_name: null,
  payout_account_number: null,
  payout_holder_name: 'Awa Koné',
  payout_verified_at: '2026-10-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
});

describe('GET /api/payouts/settings', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/payouts/settings');
    expect(res.status).toBe(401);
  });

  it('404 quand le profil gérant est absent', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      gerants: fakeChain({ data: null, error: null }),
    });

    const res = await request(app)
      .get('/api/payouts/settings')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(404);
  });

  it('renvoie la destination et son état de vérification', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      gerants: fakeChain({ data: SETTINGS, error: null }),
    });

    const res = await request(app)
      .get('/api/payouts/settings')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      method: 'mobile_money',
      phone: '+2250700000000',
      provider: 'orange',
      holder_name: 'Awa Koné',
      verified: true,
      missing_fields: [],
    });
  });
});

describe('PUT /api/payouts/settings', () => {
  it('refuse un numéro mobile money sans opérateur', async () => {
    const res = await request(app)
      .put('/api/payouts/settings')
      .set('Authorization', clerkBearer('user_1'))
      .send({ method: 'mobile_money', phone: '+2250700000000', holder_name: 'Awa Koné' });

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.provider).toBeDefined();
  });

  it('refuse un virement sans coordonnées bancaires', async () => {
    const res = await request(app)
      .put('/api/payouts/settings')
      .set('Authorization', clerkBearer('user_1'))
      .send({
        method: 'bank_transfer',
        phone: '+2250700000000',
        holder_name: 'Awa Koné',
      });

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.bank_code).toBeDefined();
    expect(res.body.details.fieldErrors.account_number).toBeDefined();
  });

  it('enregistre les coordonnées et invalide la vérification', async () => {
    const update = fakeChain({ data: { ...SETTINGS, payout_verified_at: null }, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      gerants: [fakeChain({ data: SETTINGS, error: null }), update],
    });

    const res = await request(app)
      .put('/api/payouts/settings')
      .set('Authorization', clerkBearer('user_1'))
      .send({
        method: 'mobile_money',
        phone: '+2250700000001',
        provider: 'mtn',
        holder_name: 'Awa Koné',
      });

    expect(res.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payout_phone: '+2250700000001',
        payout_provider: 'mtn',
        payout_verified_at: null,
      }),
    );
    expect(res.body.verified).toBe(false);
  });
});

describe('GET /api/payouts/mine', () => {
  it('renvoie les reversements du gérant sans identifiant prestataire', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: fakeChain({
        data: [
          {
            id: 'payout-1',
            reference: 'OUT-ABC-123',
            reservation_id: 'resa-1',
            gerant_clerk_user_id: 'user_1',
            market: 'CI',
            gross_amount: '150000',
            commission_amount: '0',
            refunded_amount: '0',
            net_amount: '150000',
            currency: 'XOF',
            provider_transfer_id: 'tr_1',
            destination_type: 'mobile_money',
            destination_phone: '+2250700000000',
            destination_provider: 'orange',
            destination_bank_code: null,
            destination_bank_name: null,
            destination_account_number: null,
            destination_holder_name: 'Awa Koné',
            status: 'paid',
            scheduled_for: '2026-10-20T00:00:00.000Z',
            paid_at: '2026-10-21T00:00:00.000Z',
            failure_code: null,
            failure_message: null,
            created_at: '2026-10-20T00:00:00.000Z',
            updated_at: '2026-10-21T00:00:00.000Z',
          },
        ],
        error: null,
      }),
    });

    const res = await request(app)
      .get('/api/payouts/mine')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      reference: 'OUT-ABC-123',
      net_amount: 150_000,
      status: 'paid',
    });
    expect(res.body[0]).not.toHaveProperty('provider_transfer_id');
  });
});
