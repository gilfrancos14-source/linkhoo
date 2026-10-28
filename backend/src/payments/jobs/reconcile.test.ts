import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { lookupProviderPayment } from '../service/providerStatus';
import { reconcilePendingPayments } from './reconcile';

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
  reference: 'PAY-2026-ABC123',
  purpose: 'booking',
  amount: 150_000,
  currency: 'XOF',
  provider_payment_link_id: 'link_1',
};

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

describe('reconcilePendingPayments', () => {
  it('ne fait rien quand le prestataire actif est FedaPay', async () => {
    setEnv({ PAYMENTS_PROVIDER: 'fedapay' });

    const result = await reconcilePendingPayments();

    expect(result.skipped).toBe(true);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('active un paiement confirmé par Hub2 via la RPC de réservation', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payments: fakeChain({ data: [PAYMENT], error: null }),
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'pay_hub2', amount: 150_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);

    const result = await reconcilePendingPayments();

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_booking', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pay_hub2',
      p_amount: 150_000,
      p_currency: 'XOF',
    });
    expect(result).toMatchObject({ checked: 1, claimed: 1, closed: 0, skipped: false });
  });

  it('ferme un paiement que Hub2 déclare échoué', async () => {
    const close = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payments: [fakeChain({ data: [PAYMENT], error: null }), close],
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'failed',
    });

    const result = await reconcilePendingPayments();

    expect(close.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, claimed: 0, closed: 1 });
  });

  it('laisse ouvert un paiement toujours en attente', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payments: fakeChain({ data: [PAYMENT], error: null }),
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'pending',
    });

    const result = await reconcilePendingPayments();

    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, claimed: 0, closed: 0 });
  });

  it('continue le lot quand Hub2 échoue sur un paiement', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useSupabaseTables(supabaseAdmin.from, {
      payments: fakeChain({ data: [PAYMENT], error: null }),
    });
    vi.mocked(lookupProviderPayment).mockRejectedValue(new Error('réseau'));

    const result = await reconcilePendingPayments();

    expect(result).toMatchObject({ checked: 1, claimed: 0, closed: 0 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
