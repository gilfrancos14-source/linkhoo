import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import {
  fakeChain,
  useSupabaseTables,
} from '../../testHelpers/supertestApp';
import {
  claimSucceededPayment,
  OPEN_PAYMENT_STATUSES,
  setPaymentStatusIfOpen,
} from './applyEvent';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const PAYMENT = {
  reference: 'PAY-2026-ABC123',
  purpose: 'premium',
  amount: 5_000,
  currency: 'XOF',
  status: 'pending',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('claimSucceededPayment', () => {
  it('active un premium via la RPC atomique', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payments: fakeChain({ data: { metadata: { premium_days: 30 } }, error: null }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    await claimSucceededPayment({
      reference: PAYMENT.reference,
      purpose: 'premium',
      providerPaymentId: 'dep_1',
      amount: PAYMENT.amount,
      currency: PAYMENT.currency,
    });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'dep_1',
      p_amount: 5_000,
      p_currency: 'XOF',
      p_days: 30,
    });
  });

  it('marque la réservation payée via payment_claim_booking', async () => {
    useSupabaseTables(supabaseAdmin.from, {});
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    await claimSucceededPayment({
      reference: PAYMENT.reference,
      purpose: 'booking',
      providerPaymentId: 'dep_booking',
      amount: PAYMENT.amount,
      currency: PAYMENT.currency,
    });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_booking', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'dep_booking',
      p_amount: 5_000,
      p_currency: 'XOF',
    });
  });

  it('utilise le claim générique pour un autre produit', async () => {
    useSupabaseTables(supabaseAdmin.from, {});
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    await claimSucceededPayment({
      reference: PAYMENT.reference,
      purpose: 'boost',
      providerPaymentId: 'dep_2',
      amount: PAYMENT.amount,
      currency: PAYMENT.currency,
    });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_succeeded', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'dep_2',
      p_amount: 5_000,
      p_currency: 'XOF',
    });
  });

  it('propage une erreur RPC pour déclencher un rejeu pawaPay', async () => {
    useSupabaseTables(supabaseAdmin.from, {});
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_AMOUNT_MISMATCH' },
    } as never);

    await expect(
      claimSucceededPayment({
        reference: PAYMENT.reference,
        purpose: 'premium',
        providerPaymentId: 'dep_3',
        amount: 100,
        currency: 'XOF',
      }),
    ).rejects.toMatchObject({ message: 'PAYMENT_AMOUNT_MISMATCH' });
  });
});

describe('setPaymentStatusIfOpen', () => {
  it('ne met à jour que les statuts encore ouverts', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, { payments: update });

    await setPaymentStatusIfOpen(PAYMENT.reference, 'canceled');

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
    expect(update.in).toHaveBeenCalledWith('status', [...OPEN_PAYMENT_STATUSES]);
    expect(OPEN_PAYMENT_STATUSES).toEqual(['created', 'pending', 'requires_action']);
  });
});
