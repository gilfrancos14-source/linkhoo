import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { requestReservationRefund } from '../service/refund';
import { expirePaidPendingBookings } from './expirePaidPending';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../service/refund', () => ({ requestReservationRefund: vi.fn() }));

const RESERVATION = { id: 'resa-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('expirePaidPendingBookings', () => {
  it('annule et rembourse une réservation payée sans réponse', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: [
        fakeChain({ data: [RESERVATION], error: null }),
        fakeChain({ data: { ...RESERVATION, statut: 'en_attente', payment_status: 'paid' }, error: null }),
        update,
      ],
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'processing',
      refundId: 'refund-1',
    });

    const result = await expirePaidPendingBookings();

    expect(requestReservationRefund).toHaveBeenCalledWith({
      reservationId: RESERVATION.id,
      reason: 'auto_expiry',
      requestedBy: 'job:auto_expiry',
    });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ statut: 'annulee' }),
    );
    expect(result).toEqual({ checked: 1, cancelled: 1, blocked: 0 });
  });

  it('conserve la réservation quand le remboursement est refusé', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: [
        fakeChain({ data: [RESERVATION], error: null }),
        fakeChain({ data: { ...RESERVATION, statut: 'en_attente', payment_status: 'paid' }, error: null }),
        update,
      ],
    });
    vi.mocked(requestReservationRefund).mockResolvedValue({
      requested: true,
      status: 'failed',
      refundId: 'refund-1',
      reason: 'provider_refused',
    });

    const result = await expirePaidPendingBookings();

    expect(update.update).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, cancelled: 0, blocked: 1 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('retente au prochain tour quand le remboursement lève', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: [
        fakeChain({ data: [RESERVATION], error: null }),
        fakeChain({ data: { ...RESERVATION, statut: 'en_attente', payment_status: 'paid' }, error: null }),
        update,
      ],
    });
    vi.mocked(requestReservationRefund).mockRejectedValue(new Error('Hub2 indisponible'));

    const result = await expirePaidPendingBookings();

    expect(update.update).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, cancelled: 0, blocked: 0 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('ne rembourse pas une réservation confirmée entre-temps', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: [
        fakeChain({ data: [RESERVATION], error: null }),
        fakeChain({ data: { ...RESERVATION, statut: 'confirmee', payment_status: 'paid' }, error: null }),
        update,
      ],
    });

    const result = await expirePaidPendingBookings();

    expect(requestReservationRefund).not.toHaveBeenCalled();
    expect(update.update).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, cancelled: 0, blocked: 0 });
  });

  it('ne fait rien sans réservation éligible', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: [], error: null }),
    });

    const result = await expirePaidPendingBookings();

    expect(result).toEqual({ checked: 0, cancelled: 0, blocked: 0 });
    expect(requestReservationRefund).not.toHaveBeenCalled();
  });
});
