import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import { PawapayApiError } from '../pawapay/client';
import { createPayout } from '../pawapay/payouts';
import {
  buildPawapayDestination,
  computeGerantBalance,
  computePayoutAmounts,
  hasValidPawapayDestination,
  missingPayoutFields,
  newPayoutReference,
  payoutDueAt,
  processScheduledPayoutsPawapay,
  requestWithdrawal,
  scheduleDuePayoutsPawapay,
  type PayoutRow,
  type PayoutSettings,
} from './payout';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../pawapay/payouts', () => ({
  createPayout: vi.fn(),
  getPayout: vi.fn(),
}));

const PAWAPAY_ENV: Record<string, string> = {
  PAWAPAY_API_KEY: 'pawapay_api_key_test',
  PAWAPAY_MERCHANT_ID: 'pawapay_merchant_test',
  PAWAPAY_ENV: 'sandbox',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...PAWAPAY_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const SETTINGS: PayoutSettings = {
  clerk_user_id: 'user_gerant_1',
  market: 'CI',
  payout_method: 'mobile_money',
  payout_phone: '+2250700000000',
  payout_provider: 'ORANGE_CIV',
  payout_bank_code: null,
  payout_bank_name: null,
  payout_account_number: null,
  payout_holder_name: 'Awa Koné',
  payout_verified_at: '2026-10-01T00:00:00.000Z',
  // Statuts de commission : vérifié seul → 10 %.
  is_verified: true,
  is_premium: false,
  premium_expires_at: null,
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
    destination_provider: 'ORANGE_CIV',
    destination_bank_code: null,
    destination_bank_name: null,
    destination_account_number: null,
    destination_holder_name: 'Awa Koné',
    status: 'processing',
    scheduled_for: '2026-10-20T00:00:00.000Z',
    paid_at: null,
    failure_code: null,
    failure_message: null,
    kind: 'reservation',
    requested_at: null,
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
  for (const key of Object.keys(PAWAPAY_ENV)) delete process.env[key];
});

describe('missingPayoutFields / buildPawapayDestination', () => {
  it('accepte une destination mobile money complète', () => {
    expect(missingPayoutFields(SETTINGS)).toEqual([]);
    expect(buildPawapayDestination(SETTINGS)).toEqual({
      type: 'MMO',
      accountDetails: {
        phoneNumber: '+2250700000000',
        provider: 'ORANGE_CIV',
      },
    });
    expect(hasValidPawapayDestination(SETTINGS)).toBe(true);
  });

  it('signale les champs manquants d’un virement', () => {
    const missing = missingPayoutFields({
      ...SETTINGS,
      payout_method: 'bank_transfer',
    });

    expect(missing).toEqual(
      expect.arrayContaining(['account_number', 'bank_code', 'bank_name']),
    );
    expect(buildPawapayDestination({ ...SETTINGS, payout_method: 'bank_transfer' })).toBeNull();
  });

  it('refuse un opérateur inconnu du marché pawaPay', () => {
    expect(hasValidPawapayDestination({ ...SETTINGS, payout_provider: 'orange' })).toBe(false);
    expect(buildPawapayDestination({ ...SETTINGS, payout_provider: 'orange' })).toBeNull();
  });

  it('refuse un numéro que pawaPay ne peut pas normaliser', () => {
    expect(hasValidPawapayDestination({ ...SETTINGS, payout_phone: null })).toBe(false);
    expect(hasValidPawapayDestination({ ...SETTINGS, payout_phone: 'abc' })).toBe(false);
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

describe('scheduleDuePayoutsPawapay', () => {
  const NOW = new Date('2026-10-28T12:00:00.000Z');

  it('ne fait rien quand aucune réservation n’est due', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: [], error: null }),
    });

    const result = await scheduleDuePayoutsPawapay(NOW);

    expect(result).toEqual({ skipped: false, checked: 0, created: 0, blocked: 0 });
  });

  it('crée un payout dû et notifie quand la destination est valide', async () => {
    const insert = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: [
          {
            id: 'resa-1',
            room_id: 'room-1',
            date_debut: '2026-10-20',
            date_fin: '2026-10-24',
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

    const result = await scheduleDuePayoutsPawapay(NOW);

    expect(result).toMatchObject({ checked: 1, created: 1, blocked: 0, skipped: false });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: 'resa-1',
        gerant_clerk_user_id: 'user_gerant_1',
        // Gérant vérifié → 10 % de commission (15 000 sur 150 000).
        commission_amount: 15_000,
        net_amount: 135_000,
        currency: 'XOF',
        status: 'scheduled',
        failure_code: null,
      }),
    );
  });

  it('bloque le payout et notifie quand les coordonnées ne sont pas valides', async () => {
    const insert = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: [
          {
            id: 'resa-1',
            room_id: 'room-1',
            date_debut: '2026-10-20',
            date_fin: '2026-10-24',
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
      gerants: fakeChain({ data: [{ ...SETTINGS, payout_phone: null }], error: null }),
      payment_policies: fakeChain({
        data: { market: 'CI', commission_percent: 0, payout_delay_hours: 24 },
        error: null,
      }),
      notifications: fakeChain({ data: null, error: null }),
    });

    const result = await scheduleDuePayoutsPawapay(NOW);

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
            date_fin: '2026-10-30',
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

    const result = await scheduleDuePayoutsPawapay(NOW);

    expect(result).toMatchObject({ checked: 1, created: 0 });
    expect(insert.insert).not.toHaveBeenCalled();
  });
});

describe('processScheduledPayoutsPawapay', () => {
  const NOW = new Date('2026-10-28T12:00:00.000Z');

  it('envoie le transfert et marque le payout payé', async () => {
    const claim = fakeChain({ data: { id: 'payout-1' }, error: null });
    const paidUpdate = fakeChain({ data: { id: 'payout-1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [
        fakeChain({ data: [payoutRow({ status: 'scheduled' })], error: null }),
        claim,
        paidUpdate,
      ],
      gerants: fakeChain({ data: [SETTINGS], error: null }),
      notifications: fakeChain({ data: null, error: null }),
    });
    vi.mocked(createPayout).mockResolvedValue({
      payoutId: 'tr_pawa_1',
      amount: '150000',
      currency: 'XOF',
      status: 'COMPLETED',
      created: '2026-10-28T12:00:00.000Z',
    });

    const result = await processScheduledPayoutsPawapay(NOW);

    expect(createPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150_000,
        currency: 'XOF',
        phoneNumber: expect.any(String),
        provider: 'ORANGE_CIV',
        paymentPayoutId: 'payout-1',
      }),
    );
    expect(paidUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid', provider_transfer_id: 'tr_pawa_1' }),
    );
    expect(result).toMatchObject({ checked: 1, sent: 1, paid: 1, failed: 0 });
  });

  it('marque le payout en échec sur un refus définitif de pawaPay', async () => {
    const claim = fakeChain({ data: { id: 'payout-1' }, error: null });
    const failedUpdate = fakeChain({ data: { id: 'payout-1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [
        fakeChain({ data: [payoutRow({ status: 'scheduled' })], error: null }),
        claim,
        failedUpdate,
      ],
      gerants: fakeChain({ data: [SETTINGS], error: null }),
      notifications: fakeChain({ data: null, error: null }),
    });
    vi.mocked(createPayout).mockRejectedValue(
      new PawapayApiError('Numéro invalide', 400),
    );

    const result = await processScheduledPayoutsPawapay(NOW);

    expect(failedUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failure_code: 'pawapay_refused' }),
    );
    expect(result).toMatchObject({ checked: 1, failed: 1 });
  });

  it('laisse le payout en attente quand les coordonnées ne sont pas valides', async () => {
    const deferredUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_payouts: [
        fakeChain({ data: [payoutRow({ status: 'scheduled' })], error: null }),
        deferredUpdate,
      ],
      gerants: fakeChain({ data: [{ ...SETTINGS, payout_phone: null }], error: null }),
    });

    const result = await processScheduledPayoutsPawapay(NOW);

    expect(createPayout).not.toHaveBeenCalled();
    expect(deferredUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ failure_code: 'payout_details_missing' }),
    );
    expect(result).toMatchObject({ checked: 1, deferred: 1, sent: 0 });
  });
});

// ============================================================
// Portefeuille gérant : solde et demandes de retrait
// ============================================================

const PAWAPAY_SETTINGS: PayoutSettings = {
  ...SETTINGS,
  payout_provider: 'ORANGE_CIV',
};

function completedReservation() {
  return {
    id: 'resa-1',
    room_id: 'room-1',
    date_fin: '2026-10-01',
    payment_id: 'pay-1',
    refunded_amount: 0,
  };
}

function succeededPayment() {
  return { id: 'pay-1', status: 'succeeded', amount: 90_000, currency: 'XOF' };
}

/** Chaînes `gerants` successives : `getPayoutSettings` est appelé à chaque calcul. */
function settingsStubs(settings: PayoutSettings, count: number) {
  return Array.from({ length: count }, () => fakeChain({ data: settings, error: null }));
}

interface WalletStubsInput {
  settings?: PayoutSettings | null;
  rooms?: Array<{ id: string; market: string }>;
  reservations?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  commissionPercent?: number;
  payouts?: Array<Record<string, unknown>>;
}

/**
 * Tables lues par `computeGerantBalance` : une chaîne par requête, dans l'ordre
 * du code. `gerants` et `payment_payouts` sont souvent surchargés par le test
 * (appels successifs).
 */
function walletStubs(input: WalletStubsInput) {
  return {
    gerants: fakeChain({ data: input.settings ?? null, error: null }),
    rooms: fakeChain({ data: input.rooms ?? [], error: null }),
    reservations: fakeChain({ data: input.reservations ?? [], error: null }),
    payments: fakeChain({ data: input.payments ?? [], error: null }),
    payment_policies: fakeChain({
      data: {
        market: 'CI',
        online_payment_enabled: true,
        deposit_percent: 100,
        commission_percent: input.commissionPercent ?? 0,
        payout_delay_hours: 24,
      },
      error: null,
    }),
    payment_payouts: fakeChain({ data: input.payouts ?? [], error: null }),
  };
}

describe('computeGerantBalance', () => {
  it('crédite le net des séjours terminés et déduit les versements', async () => {
    useSupabaseTables(
      supabaseAdmin.from,
      walletStubs({
        settings: PAWAPAY_SETTINGS,
        rooms: [{ id: 'room-1', market: 'CI' }],
        reservations: [
          {
            id: 'resa-1',
            room_id: 'room-1',
            date_fin: '2026-10-01',
            payment_id: 'pay-1',
            refunded_amount: 5_000,
          },
        ],
        payments: [{ id: 'pay-1', status: 'succeeded', amount: 100_000, currency: 'XOF' }],
        commissionPercent: 10,
        payouts: [
          {
            net_amount: 50_000,
            currency: 'XOF',
            status: 'paid',
            paid_at: '2026-10-10T00:00:00.000Z',
          },
          { net_amount: 10_000, currency: 'XOF', status: 'scheduled', paid_at: null },
        ],
      }),
    );

    const balance = await computeGerantBalance('user_gerant_1');

    // Net = 100 000 − 10 % de commission (10 000) − 5 000 remboursés.
    expect(balance).toEqual({
      currency: 'XOF',
      earned: 85_000,
      available: 25_000,
      pending: 10_000,
      paid: 50_000,
      last_payout_at: '2026-10-10T00:00:00.000Z',
      // Gérant vérifié seul → 10 %.
      commission_percent: 10,
      commission_tier: 'verified',
    });
  });

  it('ignore une réservation dont le paiement n’est pas encaissé', async () => {
    useSupabaseTables(
      supabaseAdmin.from,
      walletStubs({
        settings: PAWAPAY_SETTINGS,
        rooms: [{ id: 'room-1', market: 'CI' }],
        reservations: [completedReservation()],
        payments: [],
        payouts: [],
      }),
    );

    const balance = await computeGerantBalance('user_gerant_1');

    expect(balance).toMatchObject({ earned: 0, available: 0, pending: 0, paid: 0 });
  });

  it('ne rend jamais le solde disponible négatif', async () => {
    useSupabaseTables(
      supabaseAdmin.from,
      walletStubs({
        settings: PAWAPAY_SETTINGS,
        rooms: [{ id: 'room-1', market: 'CI' }],
        reservations: [completedReservation()],
        payments: [succeededPayment()],
        payouts: [
          { net_amount: 100_000, currency: 'XOF', status: 'paid', paid_at: '2026-10-10T00:00:00.000Z' },
        ],
      }),
    );

    const balance = await computeGerantBalance('user_gerant_1');

    expect(balance.available).toBe(0);
    expect(balance.paid).toBe(100_000);
  });
});

describe('requestWithdrawal', () => {
  it('refuse une destination incomplète pour pawaPay', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      gerants: fakeChain({
        data: { ...PAWAPAY_SETTINGS, payout_provider: 'orange' },
        error: null,
      }),
    });

    await expect(requestWithdrawal('user_gerant_1')).rejects.toMatchObject({
      code: 'PAYOUT_DETAILS_INCOMPLETE',
    });
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('refuse un montant supérieur au solde disponible', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      ...walletStubs({
        settings: PAWAPAY_SETTINGS,
        rooms: [{ id: 'room-1', market: 'CI' }],
        reservations: [completedReservation()],
        payments: [succeededPayment()],
        payouts: [],
      }),
      gerants: settingsStubs(PAWAPAY_SETTINGS, 2),
    });

    await expect(requestWithdrawal('user_gerant_1', 90_001)).rejects.toMatchObject({
      code: 'PAYOUT_AMOUNT_INVALID',
    });
  });

  it('refuse un second retrait tant que le premier est en cours', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      ...walletStubs({
        settings: PAWAPAY_SETTINGS,
        rooms: [{ id: 'room-1', market: 'CI' }],
        reservations: [completedReservation()],
        payments: [succeededPayment()],
        payouts: [],
      }),
      gerants: settingsStubs(PAWAPAY_SETTINGS, 2),
      payment_payouts: [
        fakeChain({ data: [], error: null }),
        fakeChain({ data: { id: 'payout-active' }, error: null }),
      ],
    });

    await expect(requestWithdrawal('user_gerant_1')).rejects.toMatchObject({
      code: 'PAYOUT_WITHDRAWAL_PENDING',
    });
  });

  it('enregistre un retrait au montant demandé et le programme', async () => {
    const inserted = payoutRow({
      id: 'payout-w1',
      reference: 'OUT-W-1',
      reservation_id: null,
      gross_amount: 40_000,
      commission_amount: 0,
      refunded_amount: 0,
      net_amount: 40_000,
      status: 'scheduled',
      kind: 'withdrawal',
      requested_at: '2026-10-28T12:00:00.000Z',
      paid_at: null,
    });
    const insertChain = fakeChain({ data: inserted, error: null });

    useSupabaseTables(supabaseAdmin.from, {
      ...walletStubs({
        settings: PAWAPAY_SETTINGS,
        rooms: [{ id: 'room-1', market: 'CI' }],
        reservations: [completedReservation()],
        payments: [succeededPayment()],
        payouts: [],
      }),
      gerants: settingsStubs(PAWAPAY_SETTINGS, 3),
      payment_payouts: [
        // 1. solde avant retrait, 2. contrôle du retrait actif, 3. insertion,
        // 4. solde recalculé après l'insertion.
        fakeChain({ data: [], error: null }),
        fakeChain({ data: null, error: null }),
        insertChain,
        fakeChain({
          data: [
            { net_amount: 40_000, currency: 'XOF', status: 'scheduled', paid_at: null },
          ],
          error: null,
        }),
      ],
      notifications: fakeChain({ data: null, error: null }),
    });

    const result = await requestWithdrawal('user_gerant_1', 40_000);

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'withdrawal',
        reservation_id: null,
        gross_amount: 40_000,
        commission_amount: 0,
        refunded_amount: 0,
        net_amount: 40_000,
        status: 'scheduled',
        requested_at: expect.any(String),
      }),
    );
    expect(result.payout).toBe(inserted);
    // 90 000 crédités, dont 40 000 en cours de retrait.
    expect(result.balance).toMatchObject({ earned: 81_000, pending: 40_000, available: 41_000 });
  });
});
