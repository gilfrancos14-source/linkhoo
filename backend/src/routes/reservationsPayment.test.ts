import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reservationsRouter from './reservations';
import { supabaseAdmin } from '../config/supabase';
import { Hub2ConfigError } from '../payments/config';
import { PaymentServiceError } from '../payments/errors';
import { Hub2Error } from '../payments/hub2/client';
import {
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';
import { startBookingPayment, confirmBookingPayment } from '../payments/service/booking';
import { requestReservationRefund } from '../payments/service/refund';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

vi.mock('../utils/rateLimiters', () => ({
  createClientLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: vi.fn(async () => {}),
}));

vi.mock('../payments/service/booking', () => ({
  startBookingPayment: vi.fn(),
  confirmBookingPayment: vi.fn(),
}));

vi.mock('../payments/service/refund', () => ({
  requestReservationRefund: vi.fn(),
}));

const app = buildTestApp('/api/reservations', reservationsRouter);

const SESSION = {
  reference: 'PAY-2026-ABC123',
  checkoutUrl: 'https://pay.hub2.io/link_1',
  amount: 150_000,
  currency: 'XOF' as const,
  amountXof: 150_000,
  expiresAt: '2026-10-27T11:00:00.000Z',
};

const validReservation = {
  client_name: 'Jean Koffi',
  client_email: 'jean@example.ci',
  client_phone: '+225 07 00 00 00 00',
  room_id: 'room-1',
  room_title: 'Studio Cocody',
  date_debut: '2026-05-01',
  date_fin: '2026-05-04',
  duree_nombre: 3,
  duree_unite: 'nuit',
  montant: 150000,
};

const qualifiedGerant = {
  is_verified: true,
  is_premium: true,
  premium_expires_at: '2099-01-01T00:00:00.000Z',
};

const paidReservation = {
  id: 'r1',
  client_name: 'Jean',
  client_email: 'jean@example.ci',
  client_phone: '+2250700000000',
  room_id: 'room-1',
  room_title: 'Studio',
  date_debut: '2026-05-01',
  date_fin: '2026-05-04',
  statut: 'en_attente',
  payment_status: 'paid',
};

function stubTables(tables: Record<string, FakeChain | FakeChain[]> = {}): void {
  useSupabaseTables(supabaseAdmin.from, tables);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  stubTables();
});

describe('POST /api/reservations/:id/payment', () => {
  it('422 quand le paiement en ligne est indisponible', async () => {
    vi.mocked(startBookingPayment).mockResolvedValue({
      state: 'unavailable',
      reason: 'provider_disabled',
    });

    const res = await request(app).post('/api/reservations/r1/payment');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'PAYMENT_PROVIDER_DISABLED' });
  });

  it('422 quand le marché n’a pas le paiement en ligne', async () => {
    vi.mocked(startBookingPayment).mockResolvedValue({
      state: 'unavailable',
      reason: 'online_payment_disabled',
    });

    const res = await request(app).post('/api/reservations/r1/payment');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'ONLINE_PAYMENT_DISABLED' });
  });

  it('200 : renvoie le lien de checkout', async () => {
    vi.mocked(startBookingPayment).mockResolvedValue({ state: 'checkout', session: SESSION });

    const res = await request(app).post('/api/reservations/r1/payment');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      state: 'checkout',
      reference: SESSION.reference,
      checkout_url: SESSION.checkoutUrl,
      amount: SESSION.amount,
      currency: 'XOF',
      amount_xof: SESSION.amountXof,
      expires_at: SESSION.expiresAt,
    });
  });

  it('200 : signale une réservation déjà payée', async () => {
    vi.mocked(startBookingPayment).mockResolvedValue({
      state: 'paid',
      reference: SESSION.reference,
    });

    const res = await request(app).post('/api/reservations/r1/payment');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'paid', reference: SESSION.reference });
  });

  it('404 quand la réservation n’existe pas', async () => {
    vi.mocked(startBookingPayment).mockRejectedValue(
      new PaymentServiceError('PAYMENT_NOT_FOUND', 'Réservation introuvable.', 404),
    );

    const res = await request(app).post('/api/reservations/r1/payment');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
  });

  it('502 quand Hub2 est indisponible', async () => {
    vi.mocked(startBookingPayment).mockRejectedValue(
      new Hub2Error('réseau', { code: 'HUB2_NETWORK_ERROR' }),
    );

    const res = await request(app).post('/api/reservations/r1/payment');

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: 'HUB2_NETWORK_ERROR' });
  });
});

describe('POST /api/reservations/payment/confirm', () => {
  it('400 sur une référence absente', async () => {
    const res = await request(app).post('/api/reservations/payment/confirm').send({});

    expect(res.status).toBe(400);
    expect(confirmBookingPayment).not.toHaveBeenCalled();
  });

  it('200 : confirme le paiement de la réservation', async () => {
    vi.mocked(confirmBookingPayment).mockResolvedValue({
      alreadyPaid: false,
      paymentStatus: 'paid',
      paidAt: '2026-10-27T10:00:00.000Z',
      reservation: { id: 'r1' },
    });

    const res = await request(app)
      .post('/api/reservations/payment/confirm')
      .send({ reference: 'PAY-2026-ABC123' });

    expect(res.status).toBe(200);
    expect(confirmBookingPayment).toHaveBeenCalledWith('PAY-2026-ABC123');
    expect(res.body).toMatchObject({
      success: true,
      already_paid: false,
      payment_status: 'paid',
      reservation: { id: 'r1' },
    });
  });

  it('503 quand Hub2 n’est pas configuré', async () => {
    vi.mocked(confirmBookingPayment).mockRejectedValue(
      new Hub2ConfigError('HUB2_NOT_CONFIGURED', 'clés absentes'),
    );

    const res = await request(app)
      .post('/api/reservations/payment/confirm')
      .send({ reference: 'PAY-2026-ABC123' });

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'HUB2_NOT_CONFIGURED' });
  });
});

describe('création avec paiement', () => {
  it('201 : joint le checkout à la réservation créée', async () => {
    stubTables({
      rooms: fakeChain({
        data: {
          id: 'room-1',
          disponible: true,
          title: 'Studio Cocody',
          price_num: 5000,
          price_unit: '/ nuit',
          gerant_id: 'user_1',
        },
        error: null,
      }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ id: 'resa-1', statut: 'en_attente' }],
      error: null,
    } as never);
    vi.mocked(startBookingPayment).mockResolvedValue({ state: 'checkout', session: SESSION });

    const res = await request(app).post('/api/reservations').send(validReservation);

    expect(res.status).toBe(201);
    expect(startBookingPayment).toHaveBeenCalledWith('resa-1');
    expect(res.body).toMatchObject({
      id: 'resa-1',
      payment: { state: 'checkout', checkout_url: SESSION.checkoutUrl },
    });
  });

  it('201 : la réservation reste valable si le checkout échoue', async () => {
    stubTables({
      rooms: fakeChain({
        data: {
          id: 'room-1',
          disponible: true,
          title: 'Studio Cocody',
          price_num: 5000,
          price_unit: '/ nuit',
          gerant_id: 'user_1',
        },
        error: null,
      }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ id: 'resa-1', statut: 'en_attente' }],
      error: null,
    } as never);
    vi.mocked(startBookingPayment).mockRejectedValue(new Hub2Error('panne'));

    const res = await request(app).post('/api/reservations').send(validReservation);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'resa-1', payment: null });
  });
});

describe('remboursement sur annulation', () => {
  it('PATCH annulee : rembourse une réservation payée et le signale', async () => {
    stubTables({
      gerants: [
        fakeChain({ data: qualifiedGerant, error: null }),
        fakeChain({ data: { nom: 'Aya', phone: '+2250700000000' }, error: null }),
      ],
      reservations: [
        fakeChain({ data: paidReservation, error: null }),
        fakeChain({ data: { id: 'r1', statut: 'annulee' }, error: null }),
      ],
      rooms: fakeChain({ data: { gerant_id: 'user_1' }, error: null }),
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-1',
    });

    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'annulee' });

    expect(res.status).toBe(200);
    expect(requestReservationRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'r1', reason: 'gerant_refusal' }),
    );
    expect(res.body.refund).toMatchObject({ requested: true, status: 'processing' });
  });

  it('PATCH annulee : distingue une annulation après confirmation', async () => {
    stubTables({
      gerants: [
        fakeChain({ data: qualifiedGerant, error: null }),
        fakeChain({ data: { nom: 'Aya' }, error: null }),
      ],
      reservations: [
        fakeChain({ data: { ...paidReservation, statut: 'confirmee' }, error: null }),
        fakeChain({ data: { id: 'r1', statut: 'annulee' }, error: null }),
      ],
      rooms: fakeChain({ data: { gerant_id: 'user_1' }, error: null }),
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-1',
    });

    await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'annulee' });

    expect(requestReservationRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'gerant_cancellation' }),
    );
  });

  it('PATCH confirmee : aucun remboursement', async () => {
    stubTables({
      gerants: [
        fakeChain({ data: qualifiedGerant, error: null }),
        fakeChain({ data: { nom: 'Aya' }, error: null }),
      ],
      rooms: fakeChain({ data: { gerant_id: 'user_1' }, error: null }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ id: 'r1', statut: 'confirmee' }],
      error: null,
    } as never);

    await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'confirmee' });

    expect(requestReservationRefund).not.toHaveBeenCalled();
  });

  it('POST cancel : rembourse une réservation payée', async () => {
    stubTables({
      clients: fakeChain({ data: { email: 'jean@example.ci' }, error: null }),
      reservations: [
        fakeChain({ data: paidReservation, error: null }),
        fakeChain({
          data: { id: 'r1', room_id: 'room-1', statut: 'annulee', created_at: '2026-01-01' },
          error: null,
        }),
      ],
      rooms: fakeChain({ data: { gerant_id: 'user_1' }, error: null }),
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-1',
    });

    const res = await request(app)
      .post('/api/reservations/r1/cancel')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(requestReservationRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'r1', reason: 'client_cancellation' }),
    );
    expect(res.body.refund).toMatchObject({ requested: true });
  });

  it('POST cancel : l’annulation reste valable si le remboursement échoue', async () => {
    stubTables({
      clients: fakeChain({ data: { email: 'jean@example.ci' }, error: null }),
      reservations: [
        fakeChain({ data: paidReservation, error: null }),
        fakeChain({
          data: { id: 'r1', room_id: 'room-1', statut: 'annulee', created_at: '2026-01-01' },
          error: null,
        }),
      ],
      rooms: fakeChain({ data: { gerant_id: 'user_1' }, error: null }),
    });
    vi.mocked(requestReservationRefund).mockRejectedValue(new Error('Hub2 en panne'));

    const res = await request(app)
      .post('/api/reservations/r1/cancel')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('annulee');
    expect(res.body.refund).toBeUndefined();
  });
});
