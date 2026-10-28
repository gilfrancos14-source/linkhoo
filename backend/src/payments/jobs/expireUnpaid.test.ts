import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { lookupProviderPayment } from '../service/providerStatus';
import { expireUnpaidBookings } from './expireUnpaid';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../service/providerStatus', () => ({ lookupProviderPayment: vi.fn() }));

const HUB2_ENV: Record<string, string> = {
  PAYMENTS_PROVIDER: 'hub2',
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
};

const PAYMENT = {
  id: 'pay-1',
  reference: 'PAY-2026-ABC123',
  purpose: 'booking',
  amount: 150_000,
  currency: 'XOF',
  provider_payment_link_id: 'link_1',
  reservation_id: 'resa-1',
};

const RESERVATION = { id: 'resa-1', statut: 'en_attente', payment_status: 'pending' };

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...HUB2_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  for (const key of Object.keys(HUB2_ENV)) delete process.env[key];
});

describe('expireUnpaidBookings', () => {
  it('ne fait rien quand le prestataire actif est FedaPay', async () => {
    setEnv({ PAYMENTS_PROVIDER: 'fedapay' });

    const result = await expireUnpaidBookings();

    expect(result.skipped).toBe(true);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('expire le lien et annule la réservation restée non payée', async () => {
    const paymentUpdate = fakeChain({ data: [{ id: PAYMENT.id }], error: null });
    const liveCheck = fakeChain({ data: null, error: null });
    const reservationUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payments: [fakeChain({ data: [PAYMENT], error: null }), paymentUpdate, liveCheck],
      reservations: [
        fakeChain({ data: RESERVATION, error: null }),
        reservationUpdate,
      ],
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'expired',
    });

    const result = await expireUnpaidBookings();

    expect(paymentUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    );
    expect(reservationUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ statut: 'annulee', payment_status: 'failed' }),
    );
    expect(result).toMatchObject({
      checked: 1,
      expired: 1,
      claimed: 0,
      cancelledReservations: 1,
      skipped: false,
    });
  });

  it('active le paiement au lieu de l’expirer si Hub2 le confirme', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payments: fakeChain({ data: [PAYMENT], error: null }),
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'pay_hub2', amount: 150_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);

    const result = await expireUnpaidBookings();

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_booking', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pay_hub2',
      p_amount: 150_000,
      p_currency: 'XOF',
    });
    expect(result).toMatchObject({ checked: 1, expired: 0, claimed: 1, cancelledReservations: 0 });
  });

  it('ne libère pas les dates si un autre lien est encore valide', async () => {
    const paymentUpdate = fakeChain({ data: [{ id: PAYMENT.id }], error: null });
    const reservationUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payments: [
        fakeChain({ data: [PAYMENT], error: null }),
        paymentUpdate,
        fakeChain({ data: { id: 'pay-2' }, error: null }),
      ],
      reservations: [
        fakeChain({ data: RESERVATION, error: null }),
        reservationUpdate,
      ],
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'pending',
    });

    const result = await expireUnpaidBookings();

    expect(paymentUpdate.update).toHaveBeenCalled();
    expect(reservationUpdate.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, expired: 1, cancelledReservations: 0 });
  });

  it('ne touche à rien quand Hub2 est injoignable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const paymentUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payments: [fakeChain({ data: [PAYMENT], error: null }), paymentUpdate],
    });
    vi.mocked(lookupProviderPayment).mockRejectedValue(new Error('réseau'));

    const result = await expireUnpaidBookings();

    expect(paymentUpdate.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, expired: 0, cancelledReservations: 0 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('ne libère rien si le paiement a réussi entre la lecture et l’écriture', async () => {
    const paymentUpdate = fakeChain({ data: [], error: null });
    const reservationUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payments: [fakeChain({ data: [PAYMENT], error: null }), paymentUpdate],
      reservations: [
        fakeChain({ data: RESERVATION, error: null }),
        reservationUpdate,
      ],
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'pending',
    });

    const result = await expireUnpaidBookings();

    expect(reservationUpdate.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, expired: 0, cancelledReservations: 0 });
  });

  it('ignore une réservation déjà payée entre-temps', async () => {
    const paymentUpdate = fakeChain({ data: [{ id: PAYMENT.id }], error: null });
    const reservationUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payments: [
        fakeChain({ data: [PAYMENT], error: null }),
        paymentUpdate,
        fakeChain({ data: null, error: null }),
      ],
      reservations: [
        fakeChain({
          data: { ...RESERVATION, payment_status: 'paid' },
          error: null,
        }),
        reservationUpdate,
      ],
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'pending',
    });

    await expireUnpaidBookings();

    expect(paymentUpdate.update).toHaveBeenCalled();
    expect(reservationUpdate.update).not.toHaveBeenCalled();
  });
});
