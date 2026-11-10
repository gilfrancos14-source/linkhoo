import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { createCheckout } from './checkout';
import { lookupProviderPayment } from './providerStatus';
import { confirmPremiumPayment, createPremiumCheckout } from './premium';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('./checkout', () => ({
  createCheckout: vi.fn(),
}));

vi.mock('./providerStatus', () => ({
  lookupProviderPayment: vi.fn(),
}));

const PAYMENT = {
  id: 'pay-1',
  reference: 'PAY-2026-ABC123',
  purpose: 'premium',
  status: 'pending',
  amount: 5_000,
  currency: 'XOF',
  amount_xof: 5_000,
  gerant_clerk_user_id: 'user_1',
  provider_payment_link_id: null,
  pawapay_checkout_id: 'checkout-1',
  fulfilled_at: null,
  metadata: { premium_days: 30 },
};

const GERANT = {
  id: 'g1',
  clerk_user_id: 'user_1',
  market: 'CI',
  is_premium: true,
  premium_expires_at: '2099-01-01T00:00:00.000Z',
};

function stubPaymentTables(
  payment: Record<string, unknown> | null,
  gerant: Record<string, unknown> | null = GERANT,
): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    payments: fakeChain({ data: payment, error: null }),
    gerants: fakeChain({ data: gerant, error: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPremiumCheckout', () => {
  it('ouvre un checkout premium avec le bon chemin de retour', async () => {
    vi.mocked(createCheckout).mockResolvedValue({
      reference: 'PAY-2026-ABC123',
      checkoutUrl: 'https://checkout.pawapay.io/pay-1',
      redirectUrl: 'https://checkout.pawapay.io/pay-1',
      checkoutId: 'checkout-1',
      amount: 15_000,
      currency: 'XOF',
      amountXof: 15_000,
      fxRate: 1,
      expiresAt: '2026-10-27T11:00:00.000Z',
    });

    const session = await createPremiumCheckout({
      market: 'CI',
      clerkUserId: 'user_1',
      email: 'gerant@example.ci',
    });

    expect(session.amountXof).toBe(15_000);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'premium',
        market: 'CI',
        amountXof: 15_000,
        payerType: 'gerant',
        payerClerkUserId: 'user_1',
        gerantClerkUserId: 'user_1',
        returnPath: '/ci/gerant/premium/success',
        failurePath: '/ci/gerant/premium',
        reusePendingPayment: true,
        metadata: expect.objectContaining({
          email: 'gerant@example.ci',
          premium_plan: 'monthly',
          premium_days: 30,
        }),
      }),
    );
  });
});

describe('confirmPremiumPayment', () => {
  it('404 quand la référence est inconnue', async () => {
    stubPaymentTables(null);
    await expect(confirmPremiumPayment('PAY-2026-ABC123', 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      status: 404,
    });
  });

  it('403 quand le paiement appartient à un autre gérant', async () => {
    stubPaymentTables({ ...PAYMENT, gerant_clerk_user_id: 'user_2' });
    await expect(confirmPremiumPayment('PAY-2026-ABC123', 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_FORBIDDEN',
      status: 403,
    });
  });

  it('400 quand le paiement n’est pas un premium', async () => {
    stubPaymentTables({ ...PAYMENT, purpose: 'booking' });
    await expect(confirmPremiumPayment('PAY-2026-ABC123', 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_PREMIUM',
      status: 400,
    });
  });

  it('ne rappelle pas pawaPay quand le webhook a déjà livré l’abonnement', async () => {
    stubPaymentTables({ ...PAYMENT, status: 'succeeded', fulfilled_at: '2026-10-27T10:00:00.000Z' });

    const result = await confirmPremiumPayment('PAY-2026-ABC123', 'user_1');

    expect(result).toMatchObject({
      alreadyActive: true,
      expiresAt: GERANT.premium_expires_at,
      gerant: expect.objectContaining({ id: 'g1' }),
    });
    expect(lookupProviderPayment).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('refuse un paiement sans checkout pawaPay', async () => {
    stubPaymentTables({ ...PAYMENT, pawapay_checkout_id: null });

    await expect(confirmPremiumPayment(PAYMENT.reference, 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_SUCCEEDED',
      status: 400,
    });
    expect(lookupProviderPayment).not.toHaveBeenCalled();
  });

  it('refuse tant que pawaPay n’a pas confirmé', async () => {
    stubPaymentTables(PAYMENT);
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: null,
      latestStatus: 'pending',
    });

    await expect(confirmPremiumPayment(PAYMENT.reference, 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_SUCCEEDED',
      status: 400,
      details: { status: 'pending' },
    });
  });

  it('active l’abonnement quand pawaPay renvoie un dépôt complété', async () => {
    stubPaymentTables(PAYMENT);
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'dep_1', amount: 5_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          payment_id: 'pay-1',
          already_claimed: false,
          new_expires_at: '2099-02-01T00:00:00.000Z',
          gerant_clerk_user_id: 'user_1',
          market: 'CI',
        },
      ],
      error: null,
    } as never);

    const result = await confirmPremiumPayment(PAYMENT.reference, 'user_1');

    expect(lookupProviderPayment).toHaveBeenCalledWith(PAYMENT.reference);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'dep_1',
      p_amount: 5_000,
      p_currency: 'XOF',
      p_days: 30,
    });
    expect(result).toMatchObject({
      alreadyActive: false,
      expiresAt: '2099-02-01T00:00:00.000Z',
    });
  });

  it('traduit un écart de montant en 409', async () => {
    stubPaymentTables(PAYMENT);
    vi.mocked(lookupProviderPayment).mockResolvedValue({
      payment: { id: 'dep_1', amount: 5_000, currency: 'XOF' },
      latestStatus: 'succeeded',
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_AMOUNT_MISMATCH' },
    } as never);

    await expect(confirmPremiumPayment(PAYMENT.reference, 'user_1')).rejects.toMatchObject({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      status: 409,
    });
  });
});
