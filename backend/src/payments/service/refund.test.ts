import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import type { Hub2Event } from '../hub2/webhooks';
import { applyRefundEvent, requestReservationRefund } from './refund';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

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

function response(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  };
}

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async () => response(body, init));
  vi.stubGlobal('fetch', mock);
  return mock;
}

const RESERVATION = {
  id: 'resa-1',
  payment_id: 'pay-1',
  payment_status: 'paid',
};

const PAYMENT = {
  id: 'pay-1',
  status: 'succeeded',
  amount: 150_000,
  currency: 'XOF',
  provider_payment_id: 'pay_hub2',
};

function event(type: string, data: Record<string, unknown>): Hub2Event {
  return {
    id: `evt_${type}`,
    type,
    data,
    createdAt: null,
    payload: { type, data },
    raw: JSON.stringify({ type, data }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(HUB2_ENV)) delete process.env[key];
});

describe('requestReservationRefund', () => {
  it('404 quand la réservation est inconnue', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: null, error: null }),
    });

    await expect(
      requestReservationRefund({
        reservationId: 'resa-1',
        reason: 'client_cancellation',
        requestedBy: 'client:user_1',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND', status: 404 });
  });

  it('ne fait rien quand la réservation est déjà remboursée', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: { ...RESERVATION, payment_status: 'refunded' },
        error: null,
      }),
    });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    expect(outcome).toEqual({
      requested: false,
      status: 'succeeded',
      refundId: null,
      reason: 'already_refunded',
    });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('ne fait rien quand aucun paiement réussi n’existe', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({
        data: { ...RESERVATION, payment_id: null, payment_status: 'unpaid' },
        error: null,
      }),
      payments: fakeChain({ data: null, error: null }),
    });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    expect(outcome).toEqual({
      requested: false,
      status: null,
      refundId: null,
      reason: 'not_paid',
    });
  });

  it('ne redemande rien quand le solde est déjà remboursé', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: fakeChain({
        data: [{ amount: 150_000 }],
        error: null,
      }),
    });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    expect(outcome.reason).toBe('already_refunded');
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('rembourse le solde total et transmet l’id Hub2', async () => {
    const refundUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: [
        fakeChain({ data: [], error: null }),
        refundUpdate,
      ],
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ refund_id: 'refund-db-1', already_refunded: 0, remaining: 0 }],
      error: null,
    } as never);
    const fetchMock = stubFetch({ id: 987 });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'payment_request_refund',
      expect.objectContaining({ p_payment_id: 'pay-1', p_amount: 150_000 }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/payments-refund/pay_hub2/refund');
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: 150_000,
      reasonCode: 'customer_request',
    });
    expect(refundUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        provider_refund_id: '987',
      }),
    );
    expect(outcome).toMatchObject({ requested: true, status: 'processing', refundId: 'refund-db-1' });
  });

  it('passe en traitement manuel sans identifiant de paiement Hub2', async () => {
    const refundUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({
        data: { ...PAYMENT, provider_payment_id: null },
        error: null,
      }),
      payment_refunds: [fakeChain({ data: [], error: null }), refundUpdate],
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ refund_id: 'refund-db-1' }],
      error: null,
    } as never);
    const fetchMock = stubFetch({ id: 1 });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'gerant_refusal',
      requestedBy: 'gerant:user_1',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refundUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'manual_required', provider_status: 'missing_payment_id' }),
    );
    expect(outcome).toMatchObject({
      requested: true,
      status: 'manual_required',
      reason: 'no_provider_payment',
    });
  });

  it('compense quand Hub2 refuse définitivement (4xx)', async () => {
    const refundUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: [fakeChain({ data: [], error: null }), refundUpdate],
    });
    vi.mocked(supabaseAdmin.rpc)
      .mockResolvedValueOnce({ data: [{ refund_id: 'refund-db-1' }], error: null } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);
    stubFetch({ message: 'solde insuffisant' }, { ok: false, status: 400 });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'gerant_refusal',
      requestedBy: 'gerant:user_1',
    });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_cancel_refund', {
      p_refund_id: 'refund-db-1',
    });
    expect(outcome).toMatchObject({
      requested: true,
      status: 'failed',
      reason: 'provider_refused',
    });
  });

  it('laisse en traitement une issue incertaine (5xx) sans compenser', async () => {
    const refundUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: [fakeChain({ data: [], error: null }), refundUpdate],
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ refund_id: 'refund-db-1' }],
      error: null,
    } as never);
    stubFetch({ message: 'panne' }, { ok: false, status: 503 });

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    expect(supabaseAdmin.rpc).not.toHaveBeenCalledWith('payment_cancel_refund', expect.anything());
    expect(refundUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', provider_status: 'unconfirmed' }),
    );
    expect(outcome).toMatchObject({ requested: true, status: 'processing' });
  });

  it('convertit un refus de plafond en « déjà remboursé »', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: fakeChain({ data: [], error: null }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'REFUND_EXCEEDS_PAYMENT' },
    } as never);

    const outcome = await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    expect(outcome).toMatchObject({ requested: false, reason: 'already_refunded' });
  });
});

describe('applyRefundEvent', () => {
  it('ignore un événement sans identifiant de remboursement', async () => {
    const result = await applyRefundEvent(
      event('payment_refund.successful', {}),
      'refund_succeeded',
      null,
    );

    expect(result).toEqual({ handled: false, reason: 'missing_reference' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('trace un remboursement inconnu sans échouer', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: null, error: null }),
    });

    const result = await applyRefundEvent(
      event('payment_refund.successful', { id: 42 }),
      'refund_succeeded',
      '42',
    );

    expect(result).toEqual({ handled: false, reason: 'refund_not_found' });
  });

  it('marque le remboursement réussi', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: { id: 'refund-db-1', status: 'processing' }, error: null }),
        update,
      ],
    });

    const result = await applyRefundEvent(
      event('payment_refund.successful', { id: 42, status: 'successful' }),
      'refund_succeeded',
      '42',
    );

    expect(result).toEqual({ handled: true });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        provider_status: 'successful',
      }),
    );
  });

  it('ne rétrograde pas un remboursement déjà réussi', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({
        data: { id: 'refund-db-1', status: 'succeeded' },
        error: null,
      }),
    });

    const result = await applyRefundEvent(
      event('payment_refund.failed', { id: 42, status: 'failed' }),
      'refund_failed',
      '42',
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('compense un remboursement refusé par Hub2', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: { id: 'refund-db-1', status: 'processing' }, error: null }),
        update,
      ],
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);

    const result = await applyRefundEvent(
      event('payment_refund.failed', { id: 42, status: 'failed' }),
      'refund_failed',
      '42',
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_cancel_refund', {
      p_refund_id: 'refund-db-1',
    });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ provider_status: 'failed' }),
    );
  });

  it('marque un remboursement nécessitant une action manuelle', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({ data: { id: 'refund-db-1', status: 'processing' }, error: null }),
        update,
      ],
    });

    await applyRefundEvent(
      event('payment_refund.pending_manual', { id: 42, status: 'pending_manual' }),
      'refund_manual',
      '42',
    );

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'manual_required', provider_status: 'pending_manual' }),
    );
  });
});
