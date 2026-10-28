import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { startBookingPayment, confirmBookingPayment } from './booking';
import { createCheckout } from './checkout';
import { lookupProviderPayment } from './providerStatus';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('./checkout', () => ({ createCheckout: vi.fn() }));

vi.mock('./providerStatus', () => ({ lookupProviderPayment: vi.fn() }));

const HUB2_ENV: Record<string, string> = {
  PAYMENTS_PROVIDER: 'hub2',
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
  APP_PUBLIC_URL: 'https://app.linkhoo.test',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...HUB2_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const RESERVATION = {
  id: 'resa-1',
  room_id: 'room-1',
  montant: 150_000,
  statut: 'en_attente',
  payment_status: 'unpaid',
  payment_id: null,
};

const ROOM = {
  id: 'room-1',
  market: 'CI',
  gerant_id: 'user_1',
  title: 'Studio Cocody',
};

const SESSION = {
  reference: 'PAY-2026-ABC123',
  checkoutUrl: 'https://pay.hub2.io/link_1',
  amount: 150_000,
  currency: 'XOF' as const,
  amountXof: 150_000,
  fxRate: 1,
  expiresAt: '2026-10-27T11:00:00.000Z',
};

function stubTables(tables: Record<string, unknown>): void {
  useSupabaseTables(supabaseAdmin.from, tables as never);
}

function policyChain(enabled = true) {
  return fakeChain({
    data: {
      market: 'CI',
      online_payment_enabled: enabled,
      deposit_percent: 100,
      commission_percent: 0,
      payout_delay_hours: 24,
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  for (const key of Object.keys(HUB2_ENV)) delete process.env[key];
});

describe('startBookingPayment', () => {
  it('ne crée aucun lien quand le prestataire est FedaPay', async () => {
    setEnv({ PAYMENTS_PROVIDER: 'fedapay' });

    const result = await startBookingPayment('resa-1');

    expect(result).toEqual({ state: 'unavailable', reason: 'provider_disabled' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('404 quand la réservation est inconnue', async () => {
    stubTables({ reservations: fakeChain({ data: null, error: null }) });

    await expect(startBookingPayment('resa-1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      status: 404,
    });
  });

  it('409 quand la réservation est annulée', async () => {
    stubTables({
      reservations: fakeChain({ data: { ...RESERVATION, statut: 'annulee' }, error: null }),
    });

    await expect(startBookingPayment('resa-1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_PAYABLE',
      status: 409,
    });
  });

  it('renvoie l’état payé sans rouvrir de checkout', async () => {
    stubTables({
      reservations: fakeChain({
        data: { ...RESERVATION, payment_status: 'paid' },
        error: null,
      }),
      payments: fakeChain({ data: { reference: 'PAY-2026-ABC123' }, error: null }),
    });

    const result = await startBookingPayment('resa-1');

    expect(result).toEqual({ state: 'paid', reference: 'PAY-2026-ABC123' });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('laisse le circuit direct quand le marché a le paiement en ligne fermé', async () => {
    stubTables({
      reservations: fakeChain({ data: RESERVATION, error: null }),
      rooms: fakeChain({ data: { ...ROOM, market: 'NE' }, error: null }),
      payment_policies: policyChain(false),
    });

    const result = await startBookingPayment('resa-1');

    expect(result).toEqual({ state: 'unavailable', reason: 'online_payment_disabled' });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('ouvre un checkout au montant total du séjour', async () => {
    const attach = fakeChain({ data: null, error: null });
    stubTables({
      reservations: [fakeChain({ data: RESERVATION, error: null }), attach],
      rooms: fakeChain({ data: ROOM, error: null }),
      payments: fakeChain({ data: { id: 'pay-1' }, error: null }),
      payment_policies: policyChain(),
    });
    vi.mocked(createCheckout).mockResolvedValue(SESSION);

    const result = await startBookingPayment('resa-1');

    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'booking',
        market: 'CI',
        amountXof: RESERVATION.montant,
        reservationId: RESERVATION.id,
        gerantClerkUserId: 'user_1',
        returnPath: '/ci/reservation/paiement',
        reusePendingPayment: true,
      }),
    );
    expect(attach.update).toHaveBeenCalledWith({
      payment_status: 'pending',
      payment_id: 'pay-1',
    });
    expect(result).toEqual({ state: 'checkout', session: SESSION });
  });
});

describe('confirmBookingPayment', () => {
  const PAYMENT = {
    id: 'pay-1',
    reference: 'PAY-2026-ABC123',
    purpose: 'booking',
    status: 'pending',
    amount: 150_000,
    currency: 'XOF',
    reservation_id: 'resa-1',
    provider_payment_link_id: null,
    fulfilled_at: null,
  };

  const CONFIRMED = {
    id: 'resa-1',
    room_title: 'Studio Cocody',
    date_debut: '2026-05-01',
    date_fin: '2026-05-04',
    montant: 150_000,
    statut: 'en_attente',
    payment_status: 'paid',
    paid_at: '2026-10-27T10:00:00.000Z',
  };

  it('404 quand la référence est inconnue', async () => {
    stubTables({ payments: fakeChain({ data: null, error: null }) });

    await expect(confirmBookingPayment('PAY-2026-ABC123')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      status: 404,
    });
  });

  it('400 quand le paiement n’est pas une réservation', async () => {
    stubTables({
      payments: fakeChain({ data: { ...PAYMENT, purpose: 'premium' }, error: null }),
    });

    await expect(confirmBookingPayment('PAY-2026-ABC123')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_BOOKING',
      status: 400,
    });
  });

  it('ne rappelle pas Hub2 quand le webhook a déjà tout traité', async () => {
    stubTables({
      payments: fakeChain({
        data: { ...PAYMENT, status: 'succeeded', fulfilled_at: '2026-10-27T10:00:00.000Z' },
        error: null,
      }),
      reservations: fakeChain({ data: CONFIRMED, error: null }),
    });

    const result = await confirmBookingPayment('PAY-2026-ABC123');

    expect(result).toMatchObject({
      alreadyPaid: true,
      paymentStatus: 'paid',
      paidAt: CONFIRMED.paid_at,
    });
    expect(lookupProviderPayment).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('refuse tant que Hub2 n’a pas confirmé', async () => {
    stubTables({ payments: fakeChain({ data: PAYMENT, error: null }) });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'pending',
    });

    await expect(confirmBookingPayment('PAY-2026-ABC123')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_SUCCEEDED',
      status: 400,
      details: { status: 'pending' },
    });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('marque la réservation payée via la RPC atomique', async () => {
    stubTables({
      payments: fakeChain({ data: PAYMENT, error: null }),
      reservations: fakeChain({ data: CONFIRMED, error: null }),
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'pay_hub2', amount: 150_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ payment_id: 'pay-1', reservation_id: 'resa-1', already_claimed: false }],
      error: null,
    } as never);

    const result = await confirmBookingPayment('PAY-2026-ABC123');

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_booking', {
      p_reference: 'PAY-2026-ABC123',
      p_provider_payment_id: 'pay_hub2',
      p_amount: 150_000,
      p_currency: 'XOF',
    });
    expect(result).toMatchObject({ alreadyPaid: false, paymentStatus: 'paid' });
  });

  it('traduit un écart de montant en 409', async () => {
    stubTables({ payments: fakeChain({ data: PAYMENT, error: null }) });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'pay_hub2', amount: 100, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_AMOUNT_MISMATCH' },
    } as never);

    await expect(confirmBookingPayment('PAY-2026-ABC123')).rejects.toMatchObject({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      status: 409,
    });
  });

  it('traduit un paiement non-réservation renvoyé par la RPC en 400', async () => {
    stubTables({ payments: fakeChain({ data: PAYMENT, error: null }) });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'pay_hub2', amount: 150_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_NOT_BOOKING' },
    } as never);

    await expect(confirmBookingPayment('PAY-2026-ABC123')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_BOOKING',
      status: 400,
    });
  });
});
