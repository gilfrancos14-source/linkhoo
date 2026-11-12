import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';
import adminRouter from './admin';

/**
 * Reversements aux gérants côté back-office : la liste et la relance d'un
 * reversement en échec.
 */

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: vi.fn(async () => {}),
}));

const app = buildTestApp('/api/admin', adminRouter);
const AUTH = { Authorization: `Bearer ${adminToken()}` };

function payoutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payout-1',
    reference: 'OUT-ABC123',
    reservation_id: 'resa-1',
    kind: 'reservation',
    gerant_clerk_user_id: 'user_gerant_1',
    market: 'CI',
    gross_amount: 100_000,
    commission_amount: 15_000,
    refunded_amount: 0,
    net_amount: 85_000,
    currency: 'XOF',
    destination_type: 'mobile_money',
    destination_phone: '+2250700000000',
    destination_provider: 'ORANGE_CIV',
    destination_holder_name: 'Awa Koné',
    status: 'failed',
    scheduled_for: '2026-10-25T00:00:00.000Z',
    paid_at: null,
    failure_code: 'provider_error',
    failure_message: 'Numéro refusé par l’opérateur',
    requested_at: null,
    created_at: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('admin — reversements aux gérants', () => {
  it('liste les reversements avec leurs compteurs', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [
        fakeChain({ data: [{ status: 'failed', failure_code: 'provider_error' }], error: null }),
        fakeChain({ data: [payoutRow()], error: null }),
      ],
      gerants: fakeChain({
        data: [
          { clerk_user_id: 'user_gerant_1', email: 'awa@test.ci', nom: 'Koné', prenom: 'Awa' },
        ],
        error: null,
      }),
    });

    const response = await request(app).get('/api/admin/payouts?scope=all').set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      reference: 'OUT-ABC123',
      net_amount: 85_000,
      commission_amount: 15_000,
      status: 'failed',
      gerant_email: 'awa@test.ci',
    });
    expect(response.body.counts.failed).toBe(1);
  });

  it('remet un reversement en échec dans la file d’attente', async () => {
    const update = fakeChain({
      data: payoutRow({ status: 'scheduled', failure_code: null }),
      error: null,
    });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [fakeChain({ data: payoutRow(), error: null }), update],
    });

    const response = await request(app).post('/api/admin/payouts/payout-1/retry').set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.payout.status).toBe('scheduled');
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'scheduled',
        failure_code: null,
        failure_message: null,
      }),
    );
  });

  it('refuse de relancer un reversement déjà versé', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: fakeChain({ data: payoutRow({ status: 'paid' }), error: null }),
    });

    const response = await request(app).post('/api/admin/payouts/payout-1/retry').set(AUTH);

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/déjà été versé/i);
  });
});
