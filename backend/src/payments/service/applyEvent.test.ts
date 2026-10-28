import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../../config/supabase';
import {
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../../testHelpers/supertestApp';
import type { Hub2Event } from '../hub2/webhooks';
import { applyHub2Event } from './applyEvent';

vi.mock('../../config/supabase', async () => {
  const helper = await import('../../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

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

const PAYMENT = {
  reference: 'PAY-2026-ABC123',
  purpose: 'premium',
  amount: 5_000,
  currency: 'XOF',
  status: 'pending',
};

function stubPayment(payment: Record<string, unknown> | null, update?: FakeChain): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    payments: update
      ? [fakeChain({ data: payment, error: null }), update]
      : fakeChain({ data: payment, error: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyHub2Event', () => {
  it('ignore un événement non lié aux paiements', async () => {
    const result = await applyHub2Event(
      event('invoice.paid', { purchaseReference: PAYMENT.reference }),
    );
    expect(result).toEqual({ handled: false, reason: 'unsupported_event' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('route les événements de transfert vers les reversements', async () => {
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payment_payouts: fakeChain({ data: null, error: null }),
    });

    const result = await applyHub2Event(event('transfer.succeeded', { id: 'tr_1' }));

    expect(result).toEqual({ handled: false, reason: 'payout_not_found' });
  });

  it('ignore un événement sans référence d’achat', async () => {
    const result = await applyHub2Event(event('payment_intent.succeeded', { id: 'pi_1' }));
    expect(result).toEqual({ handled: false, reason: 'missing_reference' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('trace un paiement inconnu sans échouer', async () => {
    stubPayment(null);
    const result = await applyHub2Event(
      event('payment_intent.succeeded', {
        id: 'pi_1',
        purchaseReference: PAYMENT.reference,
      }),
    );
    expect(result).toEqual({ handled: false, reason: 'payment_not_found' });
  });

  it('active un premium via la RPC atomique', async () => {
    stubPayment(PAYMENT);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    const result = await applyHub2Event(
      event('payment_intent.succeeded', {
        id: 'pi_1',
        purchaseReference: PAYMENT.reference,
      }),
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pi_1',
      p_amount: 5_000,
      p_currency: 'XOF',
      p_days: 30,
    });
  });

  it('active un premium depuis un événement Payment Link', async () => {
    stubPayment(PAYMENT);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    const result = await applyHub2Event(
      event('payment_links.paid', {
        id: 'pl_1',
        purchaseReference: PAYMENT.reference,
        amount: 5_000,
        currency: 'XOF',
      }),
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'payment_claim_premium',
      expect.objectContaining({ p_reference: PAYMENT.reference, p_amount: 5_000 }),
    );
  });

  it('transmet le montant annoncé par Hub2 pour vérification', async () => {
    stubPayment(PAYMENT);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_AMOUNT_MISMATCH' },
    } as never);

    await expect(
      applyHub2Event(
        event('payment_intent.succeeded', {
          id: 'pi_1',
          purchaseReference: PAYMENT.reference,
          amount: 100,
          currency: 'XOF',
        }),
      ),
    ).rejects.toMatchObject({ message: 'PAYMENT_AMOUNT_MISMATCH' });

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'payment_claim_premium',
      expect.objectContaining({ p_amount: 100, p_currency: 'XOF' }),
    );
  });

  it('utilise le claim générique pour un autre produit', async () => {
    stubPayment({ ...PAYMENT, purpose: 'boost' });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    const result = await applyHub2Event(
      event('payment_intent.succeeded', {
        id: 'pi_2',
        purchaseReference: PAYMENT.reference,
      }),
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_succeeded', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pi_2',
      p_amount: 5_000,
      p_currency: 'XOF',
    });
  });

  it('marque la réservation payée via payment_claim_booking', async () => {
    stubPayment({ ...PAYMENT, purpose: 'booking' });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as never);

    const result = await applyHub2Event(
      event('payment_links.paid', {
        id: 'pl_1',
        purchaseReference: PAYMENT.reference,
        amount: 5_000,
        currency: 'XOF',
        paymentAttempts: [{ id: 'pay_ok', status: 'successful' }],
      }),
    );

    expect(result).toEqual({ handled: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_booking', {
      p_reference: PAYMENT.reference,
      p_provider_payment_id: 'pay_ok',
      p_amount: 5_000,
      p_currency: 'XOF',
    });
  });

  it('route les événements de remboursement sans exiger purchaseReference', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      payment_refunds: fakeChain({ data: null, error: null }),
    });

    const result = await applyHub2Event(
      event('payment_refund.successful', { id: 42, status: 'successful' }),
    );

    expect(result).toEqual({ handled: false, reason: 'refund_not_found' });
    // Aucune lecture de `payments` : le rattachement se fait par refund id.
    expect(supabaseAdmin.from).toHaveBeenCalledWith('payment_refunds');
  });

  it('passe un paiement échoué en statut terminal', async () => {
    const update = fakeChain({ data: null, error: null });
    stubPayment(PAYMENT, update);

    const result = await applyHub2Event(
      event('payment_intent.payment_failed', {
        id: 'pi_3',
        purchaseReference: PAYMENT.reference,
      }),
    );

    expect(result).toEqual({ handled: true });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(update.in).toHaveBeenCalledWith('status', [
      'created',
      'pending',
      'requires_action',
    ]);
  });

  it('passe un paiement annulé en statut terminal', async () => {
    const update = fakeChain({ data: null, error: null });
    stubPayment(PAYMENT, update);

    await applyHub2Event(
      event('payment_intent.canceled', {
        id: 'pi_4',
        purchaseReference: PAYMENT.reference,
      }),
    );

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('marque un Payment Link expiré', async () => {
    const update = fakeChain({ data: null, error: null });
    stubPayment(PAYMENT, update);

    await applyHub2Event(
      event('payment_links.expired', {
        id: 'pl_4',
        purchaseReference: PAYMENT.reference,
      }),
    );

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    );
  });

  it('ne touche pas à un paiement déjà réussi sur un événement processing', async () => {
    const update = fakeChain({ data: null, error: null });
    stubPayment({ ...PAYMENT, status: 'succeeded' }, update);

    const result = await applyHub2Event(
      event('payment_intent.processing', {
        id: 'pi_5',
        purchaseReference: PAYMENT.reference,
      }),
    );

    // La garde est portée par `.in('status', [...])` : une ligne `succeeded`
    // ne correspond pas au filtre et n'est donc jamais rétrogradée.
    expect(result).toEqual({ handled: true });
    expect(update.in).toHaveBeenCalledWith('status', [
      'created',
      'pending',
      'requires_action',
    ]);
  });

  it('propage une erreur RPC pour que Hub2 rejoue', async () => {
    stubPayment(PAYMENT);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'PAYMENT_AMOUNT_MISMATCH' },
    } as never);

    await expect(
      applyHub2Event(
        event('payment_intent.succeeded', {
          id: 'pi_6',
          purchaseReference: PAYMENT.reference,
        }),
      ),
    ).rejects.toMatchObject({ message: 'PAYMENT_AMOUNT_MISMATCH' });
  });
});
