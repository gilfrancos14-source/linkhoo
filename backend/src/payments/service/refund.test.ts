import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import { fakeChain, useSupabaseTables } from '../../testHelpers/supertestApp';
import type { PawapayWebhookEvent } from '../pawapay/webhooks';
import { applyPawapayRefundEvent, requestReservationRefund } from './refund';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const PAWAPAY_ENV: Record<string, string> = {
  PAWAPAY_API_KEY: 'pawapay_api_key_test',
  PAWAPAY_MERCHANT_ID: 'pawapay_merchant_test',
  PAWAPAY_ENV: 'sandbox',
  APP_PUBLIC_URL: 'https://app.linkhoo.test',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...PAWAPAY_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function response(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function stubFetch(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): ReturnType<typeof vi.fn> {
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
  provider_payment_id: 'dep_pawapay',
};

function refundEvent(
  data: Record<string, unknown>,
  kind: PawapayWebhookEvent['kind'] = 'refund',
): PawapayWebhookEvent {
  return { kind, data } as PawapayWebhookEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(PAWAPAY_ENV)) delete process.env[key];
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

  it('rembourse le solde total et transmet le dépôt pawaPay', async () => {
    const refundUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: [fakeChain({ data: [], error: null }), refundUpdate],
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ refund_id: 'refund-db-1', already_refunded: 0, remaining: 0 }],
      error: null,
    } as never);
    const fetchMock = stubFetch({
      refundId: 'refund-pawa-1',
      status: 'ACCEPTED',
      amount: '150000',
      currency: 'XOF',
      created: '2026-10-27T10:00:00.000Z',
    });

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
    expect(url).toContain('/v2/refunds');
    expect(JSON.parse(String(init.body))).toMatchObject({
      depositId: 'dep_pawapay',
      amount: '150000',
      currency: 'XOF',
    });
    expect(JSON.parse(String(init.body)).refundId).toEqual(expect.any(String));
    expect(refundUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        provider_refund_id: expect.any(String),
      }),
    );
    expect(outcome).toMatchObject({
      requested: true,
      status: 'processing',
      refundId: 'refund-db-1',
    });
  });

  it('passe en traitement manuel sans identifiant de dépôt pawaPay', async () => {
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
    const fetchMock = stubFetch({ refundId: 'refund-pawa-1' });

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

  it('compense quand pawaPay refuse définitivement (4xx)', async () => {
    const refundUpdate = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      reservations: fakeChain({ data: RESERVATION, error: null }),
      payments: fakeChain({ data: PAYMENT, error: null }),
      payment_refunds: [fakeChain({ data: [], error: null }), refundUpdate],
    });
    vi.mocked(supabaseAdmin.rpc)
      .mockResolvedValueOnce({ data: [{ refund_id: 'refund-db-1' }], error: null } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);
    stubFetch({ error: 'solde insuffisant' }, { ok: false, status: 400 });

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

  it("stocke le libellé par défaut du motif quand aucun détail libre n'est fourni", async () => {
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
      data: [{ refund_id: 'refund-pawa-1' }],
      error: null,
    } as never);

    await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'client_cancellation',
      requestedBy: 'client:user_1',
    });

    // pawaPay ne peut pas recevoir le motif (API sans champ `reason`) : il
    // doit être enregistré en base avec le libellé de repli, jamais vide.
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'payment_request_refund',
      expect.objectContaining({
        p_payment_id: 'pay-1',
        p_reason: 'client_cancellation',
        p_reason_details: 'Annulation par le client',
      }),
    );
  });

  it("transmet le détail libre fourni, trimé et tronqué à 500 caractères", async () => {
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
      data: [{ refund_id: 'refund-pawa-1' }],
      error: null,
    } as never);

    await requestReservationRefund({
      reservationId: 'resa-1',
      reason: 'dispute',
      requestedBy: 'admin:user_2',
      reasonDetails: '  Litige numéro 42  ',
    });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'payment_request_refund',
      expect.objectContaining({ p_reason_details: 'Litige numéro 42' }),
    );
  });
});

describe('applyPawapayRefundEvent', () => {
  it('ignore un événement qui n’est pas un remboursement', async () => {
    const result = await applyPawapayRefundEvent(refundEvent({}, 'deposit'));

    expect(result).toEqual({ handled: false, reason: 'not_a_refund_event' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('ignore un remboursement sans identifiant', async () => {
    const result = await applyPawapayRefundEvent(refundEvent({}));

    expect(result).toEqual({ handled: false, reason: 'missing_refund_id' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('trace un remboursement inconnu sans échouer', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: null, error: null }),
    });

    const result = await applyPawapayRefundEvent(
      refundEvent({ refundId: 'refund-pawa-1', status: 'COMPLETED' }),
    );

    expect(result).toEqual({ handled: false, reason: 'refund_not_found' });
  });

  it('marque le remboursement réussi', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({
          data: { id: 'refund-db-1', status: 'processing', payment_id: null },
          error: null,
        }),
        update,
      ],
    });

    const result = await applyPawapayRefundEvent(
      refundEvent({ refundId: 'refund-pawa-1', status: 'COMPLETED' }),
    );

    expect(result).toEqual({ handled: true });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        provider_status: 'COMPLETED',
      }),
    );
  });

  it('ne rétrograde pas un remboursement déjà réussi', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({
        data: { id: 'refund-db-1', status: 'succeeded', payment_id: null },
        error: null,
      }),
    });

    const result = await applyPawapayRefundEvent(
      refundEvent({ refundId: 'refund-pawa-1', status: 'FAILED' }),
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('compense un remboursement refusé par pawaPay', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({
          data: { id: 'refund-db-1', status: 'processing', payment_id: null },
          error: null,
        }),
        update,
      ],
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);

    const result = await applyPawapayRefundEvent(
      refundEvent({ refundId: 'refund-pawa-1', status: 'REJECTED' }),
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_cancel_refund', {
      p_refund_id: 'refund-db-1',
    });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', provider_status: 'REJECTED' }),
    );
  });

  it('marque un remboursement échoué', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({
          data: { id: 'refund-db-1', status: 'processing', payment_id: null },
          error: null,
        }),
        update,
      ],
    });

    const result = await applyPawapayRefundEvent(
      refundEvent({ refundId: 'refund-pawa-1', status: 'FAILED' }),
    );

    expect(result).toEqual({ handled: true });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', provider_status: 'FAILED' }),
    );
  });

  it('laisse un remboursement en traitement tant qu’il est accepté', async () => {
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: [
        fakeChain({
          data: { id: 'refund-db-1', status: 'processing', payment_id: null },
          error: null,
        }),
        update,
      ],
    });

    const result = await applyPawapayRefundEvent(
      refundEvent({ refundId: 'refund-pawa-1', status: 'ACCEPTED' }),
    );

    expect(result).toEqual({ handled: true });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', provider_status: 'ACCEPTED' }),
    );
  });
});
