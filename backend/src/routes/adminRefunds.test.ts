import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import adminRouter from './admin';
import { supabaseAdmin } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';
import { PaymentServiceError } from '../payments/errors';
import {
  listAdminRefunds,
  retryAdminRefund,
  syncAdminRefund,
} from '../payments/service/refundAdmin';

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

vi.mock('../payments/service/refundAdmin', () => ({
  listAdminRefunds: vi.fn(),
  retryAdminRefund: vi.fn(),
  syncAdminRefund: vi.fn(),
}));

const app = buildTestApp('/api/admin', adminRouter);

const REFUND_ID = '11111111-1111-4111-8111-111111111111';

function auth(token?: string) {
  const header: Record<string, string> = {};
  if (token) header.Authorization = `Bearer ${token}`;
  return header;
}

function superAdmin(): void {
  useSupabaseTables(supabaseAdmin.from, {
    admins: fakeChain({
      data: { id: 'admin-1', email: 'admin@test.ci', is_superadmin: true, permissions: [] },
      error: null,
    }),
  });
}

function adminWithoutReservations(): void {
  useSupabaseTables(supabaseAdmin.from, {
    admins: fakeChain({
      data: { id: 'admin-1', email: 'admin@test.ci', is_superadmin: false, permissions: ['gerants'] },
      error: null,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  superAdmin();
});

describe('GET /api/admin/refunds', () => {
  it('401 sans session admin', async () => {
    const res = await request(app).get('/api/admin/refunds');
    expect(res.status).toBe(401);
  });

  it('403 sans la permission réservations', async () => {
    adminWithoutReservations();
    const res = await request(app)
      .get('/api/admin/refunds')
      .set(auth(adminToken()));
    expect(res.status).toBe(403);
    expect(listAdminRefunds).not.toHaveBeenCalled();
  });

  it('400 sur un scope inconnu', async () => {
    const res = await request(app)
      .get('/api/admin/refunds?scope=inconnu')
      .set(auth(adminToken()));
    expect(res.status).toBe(400);
  });

  it('200 : renvoie les lignes et les compteurs', async () => {
    vi.mocked(listAdminRefunds).mockResolvedValue({
      items: [
        {
          id: REFUND_ID,
          paymentId: 'pay-1',
          reservationId: 'resa-1',
          status: 'failed',
          amount: 150_000,
          currency: 'XOF',
          reason: 'client_cancellation',
          reasonDetails: null,
          providerStatus: 'REJECTED',
          hasProviderRefund: true,
          hasProviderPayment: true,
          requestedAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T10:05:00Z',
          reservation: null,
        },
      ],
      counts: { failed: 1, manual_required: 0, processing: 0, total: 1 },
    });

    const res = await request(app)
      .get('/api/admin/refunds?scope=attention&limit=20')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.counts.failed).toBe(1);
    expect(listAdminRefunds).toHaveBeenCalledWith({ scope: 'attention', limit: 20 });
  });
});

describe('POST /api/admin/refunds/:id/retry', () => {
  it('400 sur un identifiant trop long', async () => {
    const res = await request(app)
      .post(`/api/admin/refunds/${'x'.repeat(300)}/retry`)
      .set(auth(adminToken()));
    expect(res.status).toBe(400);
    expect(retryAdminRefund).not.toHaveBeenCalled();
  });

  it('200 : relaie le résultat du service', async () => {
    vi.mocked(retryAdminRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-new',
    });

    const res = await request(app)
      .post(`/api/admin/refunds/${REFUND_ID}/retry`)
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body.outcome).toMatchObject({ requested: true, status: 'processing' });
    expect(retryAdminRefund).toHaveBeenCalledWith(REFUND_ID, 'admin-1');
  });

  it('expose le code métier quand le remboursement manuel est requis', async () => {
    vi.mocked(retryAdminRefund).mockRejectedValue(
      new PaymentServiceError(
        'REFUND_MANUAL_REQUIRED',
        'Paiement sans identifiant provider : remboursement manuel requis.',
        409,
      ),
    );

    const res = await request(app)
      .post(`/api/admin/refunds/${REFUND_ID}/retry`)
      .set(auth(adminToken()));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFUND_MANUAL_REQUIRED');
  });

  it('403 sans la permission réservations', async () => {
    adminWithoutReservations();
    const res = await request(app)
      .post(`/api/admin/refunds/${REFUND_ID}/retry`)
      .set(auth(adminToken()));
    expect(res.status).toBe(403);
    expect(retryAdminRefund).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/refunds/:id/sync', () => {
  it('200 : renvoie le statut relu', async () => {
    vi.mocked(syncAdminRefund).mockResolvedValue({ status: 'succeeded', synced: true });

    const res = await request(app)
      .post(`/api/admin/refunds/${REFUND_ID}/sync`)
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body.refund).toEqual({ status: 'succeeded', synced: true });
    expect(syncAdminRefund).toHaveBeenCalledWith(REFUND_ID);
  });

  it('404 quand le remboursement est inconnu', async () => {
    vi.mocked(syncAdminRefund).mockRejectedValue(
      new PaymentServiceError('REFUND_NOT_FOUND', 'Remboursement introuvable.', 404),
    );

    const res = await request(app)
      .post(`/api/admin/refunds/${REFUND_ID}/sync`)
      .set(auth(adminToken()));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REFUND_NOT_FOUND');
  });

  it('401 sans session admin', async () => {
    const res = await request(app).post(`/api/admin/refunds/${REFUND_ID}/sync`);
    expect(res.status).toBe(401);
  });
});
