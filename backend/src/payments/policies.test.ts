import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../config/supabase';
import { fakeChain, useSupabaseTables } from '../testHelpers/supertestApp';
import { getPaymentPolicy } from './policies';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPaymentPolicy', () => {
  it('retombe sur une politique sûre quand le marché n’a pas de ligne', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_policies: fakeChain({ data: null, error: null }),
    });

    await expect(getPaymentPolicy('CI')).resolves.toEqual({
      market: 'CI',
      onlinePaymentEnabled: false,
      depositPercent: 100,
      commissionPercent: 0,
      payoutDelayHours: 24,
    });
  });

  it('lit la politique du marché et normalise les numériques', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_policies: fakeChain({
        data: {
          market: 'CM',
          online_payment_enabled: true,
          deposit_percent: '100',
          commission_percent: '0',
          payout_delay_hours: '48',
        },
        error: null,
      }),
    });

    await expect(getPaymentPolicy('CM')).resolves.toEqual({
      market: 'CM',
      onlinePaymentEnabled: true,
      depositPercent: 100,
      commissionPercent: 0,
      payoutDelayHours: 48,
    });
  });

  it('propage l’erreur de lecture', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_policies: fakeChain({ data: null, error: { message: 'boom' } }),
    });

    await expect(getPaymentPolicy('CI')).rejects.toMatchObject({ message: 'boom' });
  });
});
