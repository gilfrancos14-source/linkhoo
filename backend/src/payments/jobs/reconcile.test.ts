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

const PAWAPAY_ENV: Record<string, string> = {
  PAWAPAY_API_KEY: 'pawapay_api_key_test',
  PAWAPAY_MERCHANT_ID: 'pawapay_merchant_test',
  PAWAPAY_ENV: 'sandbox',
};

const PAYMENT = {
  reference: 'PAY-2026-ABC123',
  purpose: 'booking',
  amount: 150_000,
  currency: 'XOF',
  provider_payment_link_id: 'link_1',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...PAWAPAY_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  for (const key of Object.keys(PAWAPAY_ENV)) delete process.env[key];
});

describe('reconcilePendingPayments', () => {
  it('ne fait rien quand pawaPay n’est pas configuré', async () => {
    setEnv({ PAWAPAY_API_KEY: undefined });

    const result = await reconcilePendingPayments();

    expect(result.skipped).toBe(true);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('active un paiement confirmé par pawaPay via la RPC de réservation', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payments: fakeChain({ data: [PAYMENT], error: null }),
    });
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'dep_pawapay', amount: 150_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);

    const result = await reconcilePendingPayments();

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_booking', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'dep_pawapay',
      p_amount: 150_000,
      p_currency: 'XOF',
    });
    expect(result).toMatchObject({ checked: 1, claimed: 1, closed: 0, skipped: false });
  });

  it('ferme un paiement que pawaPay déclare échoué', async () => {
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

  it('continue le lot quand pawaPay échoue sur un paiement', async () => {
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
