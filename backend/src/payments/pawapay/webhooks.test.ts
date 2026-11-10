import { describe, expect, it, vi } from 'vitest';
import type { CheckoutResource } from './types';

vi.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
vi.mock('../service/applyEvent', () => ({ claimSucceededPayment: vi.fn() }));

import { findCompletedDeposit, parsePawapayWebhook } from './webhooks';

function checkout(overrides: Partial<CheckoutResource> = {}): CheckoutResource {
  return {
    checkoutId: 'checkout-1',
    status: 'COMPLETED',
    redirectUrl: 'https://checkout.pawapay.io/x',
    checkoutCode: 'code',
    countries: ['CIV'],
    amounts: [{ country: 'CIV', currency: 'XOF', amount: '5000' }],
    depositsHistory: [],
    metadata: {},
    reason: { fr: 'Reservation' },
    created: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('parsePawapayWebhook', () => {
  it('reconnaît chaque type de callback', () => {
    expect(parsePawapayWebhook({ checkoutId: 'c' }).kind).toBe('checkout');
    expect(parsePawapayWebhook({ depositId: 'd' }).kind).toBe('deposit');
    expect(parsePawapayWebhook({ refundId: 'r' }).kind).toBe('refund');
    expect(parsePawapayWebhook({ payoutId: 'p' }).kind).toBe('payout');
    expect(parsePawapayWebhook({ foo: 'bar' }).kind).toBe('unknown');
    expect(parsePawapayWebhook(null).kind).toBe('unknown');
  });
});

describe('findCompletedDeposit', () => {
  it('privilégie un dépôt COMPLETED de l’historique même si le dernier a échoué', () => {
    const result = findCompletedDeposit(
      checkout({
        deposit: {
          depositId: 'last-failed',
          status: 'FAILED',
          created: '2026-01-01T00:02:00Z',
        },
        depositsHistory: [
          { depositId: 'failed', status: 'FAILED', created: '2026-01-01T00:01:00Z' },
          {
            depositId: 'completed',
            status: 'COMPLETED',
            created: '2026-01-01T00:00:30Z',
            amount: '5000',
            currency: 'XOF',
          },
        ],
      }),
    );

    expect(result).toMatchObject({ depositId: 'completed', amount: '5000', currency: 'XOF' });
  });

  it('retombe sur checkout.deposit si celui-ci est COMPLETED', () => {
    const result = findCompletedDeposit(
      checkout({
        deposit: {
          depositId: 'only-completed',
          status: 'COMPLETED',
          created: '2026-01-01T00:00:30Z',
        },
      }),
    );

    expect(result?.depositId).toBe('only-completed');
  });

  it('renvoie null sans dépôt COMPLETED exploitable', () => {
    expect(
      findCompletedDeposit(
        checkout({
          deposit: { depositId: 'failed', status: 'FAILED', created: '2026-01-01T00:00:00Z' },
        }),
      ),
    ).toBeNull();
  });
});
