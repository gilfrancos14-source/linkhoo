import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { Hub2Error } from '../hub2/client';
import { createTransfer } from '../hub2/transfers';
import {
  applyTransferEvent,
  buildTransferDestination,
  computePayoutAmounts,
  hasVerifiedPayoutDestination,
  missingPayoutFields,
  newPayoutReference,
  payoutDueAt,
  processScheduledPayouts,
  scheduleDuePayouts,
  type PayoutRow,
  type PayoutSettings,
} from './payout';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../hub2/transfers', () => ({
  createTransfer: vi.fn(),
  getTransfer: vi.fn(),
  findTransferByReference: vi.fn(),
}));

const HUB2_ENV: Record<string, string> = {
  PAYMENTS_PROVIDER: 'hub2',
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...HUB2_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const SETTINGS: PayoutSettings = {
  clerk_user_id: 'user_gerant_1',
  market: 'CI',
  payout_method: 'mobile_money',
  payout_phone: '+2250700000000',
  payout_provider: 'orange',
  payout_bank_code: null,
  payout_bank_name: null,
  payout_account_number: null,
  payout_holder_name: 'Awa Koné',
  payout_verified_at: '2026-10-01T00:00:00.000Z',
};

function payoutRow(overrides: Partial<PayoutRow> = {}): PayoutRow {
  return {
    id: 'payout-1',
    reference: 'OUT-ABC-123',
    reservation_id: 'resa-1',
    gerant_clerk_user_id: 'user_gerant_1',
    market: 'CI',
    gross_amount: 150_000,
    commission_amount: 0,
    refunded_amount: 0,
    net_amount: 150_000,
    currency: 'XOF',
    provider_transfer_id: 'tr_1',
    destination_type: 'mobile_money',
    destination_phone: '+2250700000000',
    destination_provider: 'orange',
    destination_bank_code: null,
    destination_bank_name: null,
    destination_account_number: null,
    destination_holder_name: 'Awa Koné',
    status: 'processing',
    scheduled_for: '2026-10-20T00:00:00.000Z',
    paid_at: null,
    failure_code: null,
    failure_message: null,
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  for (const key of Object.keys(HUB2_ENV)) delete process.env[key];
});

describe('missingPayoutFields / buildTransferDestination', () => {
  it('accepte une destination mobile money complète', () => {
    expect(missingPayoutFields(SETTINGS)).toEqual([]);
    expect(buildTransferDestination(SETTINGS)).toEqual({
      type: 'mobile_money',
      country: 'CI',
      msisdn: '+2250700000000',
      provider: 'orange',
      recipientName: 'Awa Koné',
    });
  });

  it('signale les champs manquants d’un virement', () => {
    const missing = missingPayoutFields({
      ...SETTINGS,
      payout_method: 'bank_transfer',
    });

    expect(missing).toEqual(
      expect.arrayContaining(['account_number', 'bank_code', 'bank_name']),
    );
    expect(buildTransferDestination({ ...SETTINGS, payout_method: 'bank_transfer' })).toBeNull();
  });

  it('construit un virement complet', () => {
    const destination = buildTransferDestination({
      ...SETTINGS,
      payout_method: 'bank_transfer',
      payout_bank_code: 'CI001',
      payout_bank_name: 'Ecobank',
      payout_account_number: '123456789',
    });

    expect(destination).toMatchObject({
      type: 'bank_transfer',
      country: 'CI',
      accountNumber: '123456789',
      accountOwner: 'Awa Koné',
      bankCode: 'CI001',
      bankName: 'Ecobank',
      beneficiaryPhone: '+2250700000000',
    });
  });

  it('exige une vérification explicite', () => {
    expect(hasVerifiedPayoutDestination(SETTINGS)).toBe(true);
    expect(hasVerifiedPayoutDestination({ ...SETTINGS, payout_verified_at: null })).toBe(false);
  });
});

describe('computePayoutAmounts', () => {
  it('applique la commission et déduit les remboursements', () => {
    expect(
      computePayoutAmounts({ gross: 100_000, commissionPercent: 10, refunded: 20_000 }),
    ).toEqual({ gross: 100_000, commission: 10_000, refunded: 20_000, net: 70_000 });
  });

  it('plafonne les remboursements au montant encaissé', () => {
    expect(
      computePayoutAmounts({ gross: 100_000, commissionPercent: 0, refunded: 150_000 }),
    ).toBeNull();
  });

  it('renvoie null quand il n’y a rien à reverser', () => {
    expect(computePayoutAmounts({ gross: 0, commissionPercent: 0, refunded: 0 })).toBeNull();
  });
});

describe('payoutDueAt', () => {
  it('ajoute le délai de la politique au début du séjour', () => {
    expect(payoutDueAt('2026-10-20', 24)?.toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it('ignore une date invalide', () => {
    expect(payoutDueAt('20/10/2026', 24)).toBeNull();
    expect(payoutDueAt(null, 24)).toBeNull();
  });
});

describe('newPayoutReference', () => {
  it('respecte le format de la contrainte SQL', () => {
    expect(newPayoutReference(new Date('2026-10-28T12:00:00.000Z'))).toMatch(
      /^OUT-[A-Z0-9-]{6,40}$/,
    );
  });
});

describe('scheduleDuePayouts', () => {
  const NOW = new Date('2026-10-28T12:00:00.000Z');

  it('ne fait rien quand le prestataire actif est FedaPay', async () => {
    setEnv({ PAYMENTS_PROVIDER: 'fedapay' });

    const result = await scheduleDuePayouts(NOW);

    expect(result.skipped).toBe(true);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('crée un payout dû et notifie quand la destination est vérifiée', async () => {
    const insert = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: [
          {
            id: 'resa-1',
            room_id: 'room-1',
            date_debut: '2026-10-20',
            payment_id: 'pay-1',
            refunded_amount: 0,
          },
        ],
        error: null,
      }),
      rooms: fakeChain({ data: [{ id: 'room-1', market: 'CI', gerant_id: 'user_gerant_1' }], error: null }),
      payments: fakeChain({
        data: [
          {
            id: 'pay-1',
            status: 'succeeded',
            amount: 150_000,
            currency: 'XOF',
            gerant_clerk_user_id: 'user_gerant_1',
          },
        ],
        error: null,
      }),
      payment_payouts: [fakeChain({ data: [], error: null }), insert],
      gerants: fakeChain({ data: [SETTINGS], error: null }),
      payment_policies: fakeChain({
        data: { market: 'CI', commission_percent: 0, payout_delay_hours: 24 },
        error: null,
      }),
      notifications: fakeChain({ data: null, error: null }),
    });

    const result = await scheduleDuePayouts(NOW);

    expect(result).toMatchObject({ checked: 1, created: 1, blocked: 0, skipped: false });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: 'resa-1',
        gerant_clerk_user_id: 'user_gerant_1',
        net_amount: 150_000,
        currency: 'XOF',
        status: 'scheduled',
        failure_code: null,
      }),
    );
  });

  it('bloque le payout et notifie quand les coordonnées ne sont pas vérifiées', async () => {
    const insert = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: [
          {
            id: 'resa-1',
            room_id: 'room-1',
            date_debut: '2026-10-20',
            payment_id: 'pay-1',
            refunded_amount: 0,
          },
        ],
        error: null,
      }),
      rooms: fakeChain({ data: [{ id: 'room-1', market: 'CI', gerant_id: 'user_gerant_1' }], error: null }),
      payments: fakeChain({
        data: [
          {
            id: 'pay-1',
            status: 'succeeded',
            amount: 150_000,
            currency: 'XOF',
            gerant_clerk_user_id: 'user_gerant_1',
          },
        ],
        error: null,
      }),
      payment_payouts: [fakeChain({ data: [], error: null }), insert],
      gerants: fakeChain({ data: [{ ...SETTINGS, payout_verified_at: null }], error: null }),
      payment_policies: fakeChain({
        data: { market: 'CI', commission_percent: 0, payout_delay_hours: 24 },
        error: null,
      }),
      notifications: fakeChain({ data: null, error: null }),
    });

    const result = await scheduleDuePayouts(NOW);

    expect(result).toMatchObject({ checked: 1, created: 1, blocked: 1 });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ failure_code: 'payout_details_missing' }),
    );
  });

  it('ignore un séjour qui n’a pas encore atteint le délai de payout', async () => {
    const insert = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: [
          {
            id: 'resa-1',
            room_id: 'room-1',
            date_debut: '2026-10-28',
            payment_id: 'pay-1',
            refunded_amount: 0,
          },
        ],
        error: null,
      }),
      rooms: fakeChain({ data: [{ id: 'room-1', market: 'CI', gerant_id: 'user_gerant_1' }], error: null }),
      payments: fakeChain({
        data: [
          {
            id: 'pay-1',
            status: 'succeeded',
            amount: 150_000,
            currency: 'XOF',
            gerant_clerk_user_id: 'user_gerant_1',
          },
        ],
        error: null,
      }),
      payment_payouts: fakeChain({ data: [], error: null }),
      gerants: fakeChain({ data: [SETTINGS], error: null }),
      payment_policies: fakeChain({
        data: { market: 'CI', commission_percent: 0, payout_delay_hours: 24 },
        error: null,
      }),
    });

    const result = await scheduleDuePayouts(NOW);

    expect(result).toMatchObject({ checked: 1, created: 0 });
    expect(insert.insert).not.toHaveBeenCalled();
  });
});

describe('processScheduledPayouts', () => {
  const NOW = new Date('2026-10-28T12:00:00.000Z');

  it('envoie le transfert et marque le payout payé', async () => {
    const claim = fakeChain({ data: { id: 'payout-1' }, error: null });
    const paidUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [fakeChain({ data: [payoutRow({ status: 'scheduled' })], error: null }), claim, paidUpdate],
      gerants: fakeChain({ data: [SETTINGS], error: null }),
      notifications: fakeChain({ data: null, error: null }),
    });
    vi.mocked(createTransfer).mockResolvedValue({
      id: 'tr_1',
      reference: 'OUT-ABC-123',
      status: 'paid',
      providerStatus: 'successful',
      amount: 150_000,
      currency: 'XOF',
      failureCode: null,
      failureMessage: null,
    });

    const result = await processScheduledPayouts(NOW);

    expect(createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk_test_123' }),
      expect.objectContaining({
        reference: 'OUT-ABC-123',
        amount: 150_000,
        currency: 'XOF',
        destination: expect.objectContaining({ type: 'mobile_money', provider: 'orange' }),
      }),
    );
    expect(paidUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid', provider_transfer_id: 'tr_1' }),
    );
    expect(result).toMatchObject({ checked: 1, sent: 1, paid: 1, failed: 0 });
  });

  it('marque le payout en échec sur un refus définitif de Hub2', async () => {
    const claim = fakeChain({ data: { id: 'payout-1' }, error: null });
    const failedUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [fakeChain({ data: [payoutRow({ status: 'scheduled' })], error: null }), claim, failedUpdate],
      gerants: fakeChain({ data: [SETTINGS], error: null }),
      notifications: fakeChain({ data: null, error: null }),
    });
    vi.mocked(createTransfer).mockRejectedValue(
      new Hub2Error('Numéro invalide', { status: 400, code: 'invalid_msisdn' }),
    );

    const result = await processScheduledPayouts(NOW);

    expect(failedUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failure_code: 'invalid_msisdn' }),
    );
    expect(result).toMatchObject({ checked: 1, failed: 1 });
  });

  it('laisse le payout en attente quand les coordonnées ne sont pas vérifiées', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [
        fakeChain({ data: [payoutRow({ status: 'scheduled' })], error: null }),
        fakeChain({ data: null, error: null }),
      ],
      gerants: fakeChain({ data: [{ ...SETTINGS, payout_verified_at: null }], error: null }),
    });

    const result = await processScheduledPayouts(NOW);

    expect(createTransfer).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, deferred: 1, sent: 0 });
  });
});

describe('applyTransferEvent', () => {
  const EVENT = {
    id: 'evt-1',
    type: 'transfer.succeeded',
    data: { id: 'tr_1', status: 'successful' },
    createdAt: null,
    payload: {},
    raw: '{}',
  };

  it('passe le payout à payé', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [fakeChain({ data: payoutRow(), error: null }), update],
      notifications: fakeChain({ data: null, error: null }),
    });

    const result = await applyTransferEvent(EVENT, 'transfer_succeeded', 'tr_1');

    expect(result.handled).toBe(true);
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid', provider_transfer_id: 'tr_1' }),
    );
  });

  it('ne rétrograde jamais un payout déjà payé', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [
        fakeChain({ data: payoutRow({ status: 'paid' }), error: null }),
        update,
      ],
    });

    const result = await applyTransferEvent(EVENT, 'transfer_failed', 'tr_1');

    expect(result).toEqual({ handled: true });
    expect(update.update).not.toHaveBeenCalled();
  });

  it('ignore un transfert inconnu', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: fakeChain({ data: null, error: null }),
    });

    const result = await applyTransferEvent(EVENT, 'transfer_succeeded', 'tr_unknown');

    expect(result).toEqual({ handled: false, reason: 'payout_not_found' });
  });
});
