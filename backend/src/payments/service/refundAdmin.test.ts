import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { getRefund } from '../pawapay/refunds';
import { applyRefundProviderStatus, requestReservationRefund } from './refund';
import { listAdminRefunds, retryAdminRefund, syncAdminRefund } from './refundAdmin';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('./refund', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./refund')>();
  return {
    ...actual,
    requestReservationRefund: vi.fn(),
    applyRefundProviderStatus: vi.fn(),
  };
});

vi.mock('../pawapay/refunds', () => ({ getRefund: vi.fn() }));

const REFUND_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';
const RESERVATION_ID = 'resa-1';

function refundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REFUND_ID,
    payment_id: PAYMENT_ID,
    reservation_id: RESERVATION_ID,
    amount: 150_000,
    currency: 'XOF',
    reason: 'client_cancellation',
    reason_details: 'Annulation par le client',
    status: 'failed',
    provider_refund_id: 'refund-provider-1',
    provider_status: 'REJECTED',
    requested_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:05:00Z',
    ...overrides,
  };
}

const PAYMENT_ROW = {
  id: PAYMENT_ID,
  reservation_id: RESERVATION_ID,
  provider_payment_id: 'dep-provider-1',
  status: 'succeeded',
};

const RESERVATION_ROW = {
  id: RESERVATION_ID,
  client_name: 'Aya Koffi',
  client_email: 'aya@example.ci',
  room_title: 'Studio Cocody',
  date_debut: '2026-11-10',
  date_fin: '2026-11-12',
  statut: 'annulee',
  payment_status: 'paid',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listAdminRefunds', () => {
  it('compte les trois statuts et joint paiement + réservation', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({
          data: [{ status: 'failed' }, { status: 'failed' }, { status: 'manual_required' }],
          error: null,
        }),
        fakeChain({
          data: [refundRow(), refundRow({ id: 'refund-2', status: 'processing' })],
          error: null,
        }),
      ],
      payments: fakeChain({ data: [PAYMENT_ROW], error: null }),
      reservations: fakeChain({ data: [RESERVATION_ROW], error: null }),
    });

    const result = await listAdminRefunds({ scope: 'attention', limit: 50 });

    expect(result.counts).toEqual({ failed: 2, manual_required: 1, processing: 0, total: 3 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: REFUND_ID,
      status: 'failed',
      amount: 150_000,
      hasProviderRefund: true,
      hasProviderPayment: true,
      reservation: {
        clientName: 'Aya Koffi',
        roomTitle: 'Studio Cocody',
        paymentStatus: 'paid',
      },
    });
  });

  it('scope processing ne renvoie que les remboursements en vol', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: [{ status: 'processing' }], error: null }),
        fakeChain({
          data: [refundRow({ status: 'processing' }), refundRow({ id: 'refund-2', status: 'failed' })],
          error: null,
        }),
      ],
      payments: fakeChain({ data: [PAYMENT_ROW], error: null }),
      reservations: fakeChain({ data: [RESERVATION_ROW], error: null }),
    });

    const result = await listAdminRefunds({ scope: 'processing' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe('processing');
    expect(result.counts).toEqual({ failed: 0, manual_required: 0, processing: 1, total: 1 });
  });

  it('tolère une réservation absente du join', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: [{ status: 'failed' }], error: null }),
        fakeChain({ data: [refundRow()], error: null }),
      ],
      payments: fakeChain({ data: [PAYMENT_ROW], error: null }),
      reservations: fakeChain({ data: [], error: null }),
    });

    const result = await listAdminRefunds();

    expect(result.items[0].reservation).toBeNull();
  });
});

describe('retryAdminRefund', () => {
  it('relance un remboursement failed avec la raison d’origine', async () => {
    const oldRefund = fakeChain({ data: refundRow(), error: null });
    const superseded = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [oldRefund, superseded],
      payments: fakeChain({ data: PAYMENT_ROW, error: null }),
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-new',
    });

    const outcome = await retryAdminRefund(REFUND_ID, 'admin-1');

    expect(outcome).toMatchObject({ requested: true, status: 'processing' });
    expect(requestReservationRefund).toHaveBeenCalledWith({
      reservationId: RESERVATION_ID,
      reason: 'client_cancellation',
      reasonDetails: 'Annulation par le client',
      requestedBy: 'admin:admin-1',
    });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    // L'ancienne tentative remplacée sort du panneau « à traiter ».
    expect(superseded.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled', provider_status: 'superseded_by_retry' }),
    );
  });

  it('libère l’ancien remboursement manual_required avant de relancer', async () => {
    const oldRefund = fakeChain({
      data: refundRow({ status: 'manual_required', provider_refund_id: null }),
      error: null,
    });
    const superseded = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [oldRefund, superseded],
      payments: fakeChain({ data: PAYMENT_ROW, error: null }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-new',
    });

    await retryAdminRefund(REFUND_ID, 'admin-1');

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_cancel_refund', {
      p_refund_id: REFUND_ID,
    });
    expect(requestReservationRefund).toHaveBeenCalledTimes(1);
    expect(superseded.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('sort l’ancienne tentative du panneau quand un remboursement est déjà vivant', async () => {
    const oldRefund = fakeChain({ data: refundRow(), error: null });
    const superseded = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [oldRefund, superseded],
      payments: fakeChain({ data: PAYMENT_ROW, error: null }),
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: false,
      status: 'succeeded',
      refundId: null,
      reason: 'already_refunded',
    });

    const outcome = await retryAdminRefund(REFUND_ID, 'admin-1');

    expect(outcome.reason).toBe('already_refunded');
    expect(superseded.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('refuse un remboursement déjà abouti', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: refundRow({ status: 'succeeded' }), error: null }),
    });

    await expect(retryAdminRefund(REFUND_ID, 'admin-1')).rejects.toMatchObject({
      code: 'REFUND_ALREADY_SUCCEEDED',
      status: 400,
    });
    expect(requestReservationRefund).not.toHaveBeenCalled();
  });

  it('refuse un remboursement encore en vol', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: refundRow({ status: 'processing' }), error: null }),
    });

    await expect(retryAdminRefund(REFUND_ID, 'admin-1')).rejects.toMatchObject({
      code: 'REFUND_IN_FLIGHT',
      status: 409,
    });
  });

  it('404 quand le remboursement est inconnu', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: null, error: null }),
    });

    await expect(retryAdminRefund(REFUND_ID, 'admin-1')).rejects.toMatchObject({
      code: 'REFUND_NOT_FOUND',
      status: 404,
    });
  });

  it('refuse quand le paiement source n’est plus réussi', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: refundRow(), error: null }),
      payments: fakeChain({ data: { ...PAYMENT_ROW, status: 'refunded' }, error: null }),
    });

    await expect(retryAdminRefund(REFUND_ID, 'admin-1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_REFUNDABLE',
      status: 409,
    });
  });

  it('refuse quand pawaPay n’a pas d’identifiant de paiement', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: refundRow(), error: null }),
      payments: fakeChain({ data: { ...PAYMENT_ROW, provider_payment_id: null }, error: null }),
    });

    await expect(retryAdminRefund(REFUND_ID, 'admin-1')).rejects.toMatchObject({
      code: 'REFUND_MANUAL_REQUIRED',
      status: 409,
    });
    expect(requestReservationRefund).not.toHaveBeenCalled();
  });

});

describe('syncAdminRefund', () => {
  it('applique un COMPLETED relu chez pawaPay', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: refundRow({ status: 'processing' }), error: null }),
        fakeChain({ data: refundRow({ status: 'succeeded' }), error: null }),
      ],
    });
    vi.mocked(getRefund).mockResolvedValue({
      refundId: 'refund-provider-1',
      depositId: 'dep-provider-1',
      status: 'COMPLETED',
      amount: '150000',
      currency: 'XOF',
      created: '2026-11-01T10:00:00Z',
    });

    const result = await syncAdminRefund(REFUND_ID);

    expect(applyRefundProviderStatus).toHaveBeenCalledWith(REFUND_ID, 'COMPLETED');
    expect(result).toEqual({ status: 'succeeded', synced: true });
  });

  it('mappe un FAILED provider sans le confondre avec un succès', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: refundRow({ status: 'processing' }), error: null }),
        fakeChain({ data: refundRow({ status: 'failed' }), error: null }),
      ],
    });
    vi.mocked(getRefund).mockResolvedValue({
      refundId: 'refund-provider-1',
      depositId: 'dep-provider-1',
      status: 'FAILED',
      amount: '150000',
      currency: 'XOF',
      created: '2026-11-01T10:00:00Z',
    });

    const result = await syncAdminRefund(REFUND_ID);

    expect(applyRefundProviderStatus).toHaveBeenCalledWith(REFUND_ID, 'FAILED');
    expect(result).toEqual({ status: 'failed', synced: true });
  });

  it('bascule en manual_required sans identifiant provider', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: refundRow({ status: 'processing', provider_refund_id: null }), error: null }),
        fakeChain({ data: null, error: null }),
      ],
    });

    const result = await syncAdminRefund(REFUND_ID);

    expect(getRefund).not.toHaveBeenCalled();
    expect(applyRefundProviderStatus).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'manual_required',
      synced: true,
      reason: 'missing_provider_refund',
    });
  });

  it('ne rappelle pas pawaPay pour un remboursement déjà abouti', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: refundRow({ status: 'succeeded' }), error: null }),
    });

    const result = await syncAdminRefund(REFUND_ID);

    expect(getRefund).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'succeeded', synced: false });
  });

  it('404 quand le remboursement est inconnu', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: null, error: null }),
    });

    await expect(syncAdminRefund(REFUND_ID)).rejects.toMatchObject({
      code: 'REFUND_NOT_FOUND',
      status: 404,
    });
  });
});
