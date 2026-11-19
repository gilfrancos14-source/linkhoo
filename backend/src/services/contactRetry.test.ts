import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../config/supabase';
import { sendContactEmail } from './mailer';
import { runContactRetries, nextRetryDelay, CONTACT_MAX_ATTEMPTS } from './contactRetry';
import { fakeChain, useSupabaseTables, type FakeChain } from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('./mailer', () => ({ sendContactEmail: vi.fn(async () => undefined) }));

const NOW = new Date('2026-11-19T12:00:00.000Z');

const ROW = {
  id: 'msg-1',
  nom: 'Kouassi',
  prenom: 'Yao',
  email: 'yao@exemple.ci',
  telephone: '+225 07 11 22 33 44',
  pays: "Côte d'Ivoire",
  sujet: 'partenariat',
  message: "Bonjour, nous aimerions discuter d'un partenariat.",
  market: 'CI',
  attempts: 0,
  error: 'Resend a répondu 401',
  created_at: '2026-11-19T11:00:00.000Z',
};

function stubSequence(chains: FakeChain[]): void {
  useSupabaseTables(supabaseAdmin.from, { contact_messages: chains });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendContactEmail).mockResolvedValue(undefined);
  stubSequence([]);
});

describe('nextRetryDelay', () => {
  it('applique un backoff borné', () => {
    expect(nextRetryDelay(1)).toBe(5 * 60 * 1000);
    expect(nextRetryDelay(2)).toBe(15 * 60 * 1000);
    expect(nextRetryDelay(99)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('runContactRetries', () => {
  it('ne fait rien sans message à reprendre', async () => {
    stubSequence([
      fakeChain({ data: [], error: null }), // verrous abandonnés
      fakeChain({ data: [], error: null }), // next_retry_at NULL
      fakeChain({ data: [], error: null }), // next_retry_at <= now
    ]);

    const result = await runContactRetries(NOW);

    expect(result).toEqual({ reclaimed: 0, sent: 0, failed: 0, exhausted: 0 });
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('renvoie un message, libère le verrou et le marque sent', async () => {
    const finalUpdate = fakeChain({ data: null, error: null });
    stubSequence([
      fakeChain({ data: [], error: null }),
      fakeChain({ data: [ROW], error: null }),
      fakeChain({ data: [], error: null }),
      fakeChain({ data: { id: ROW.id }, error: null }), // claim
      finalUpdate,
    ]);

    const result = await runContactRetries(NOW);

    expect(result.sent).toBe(1);
    expect(sendContactEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: ROW.email, pays: ROW.pays, sujet: ROW.sujet, website: '' }),
    );
    expect(finalUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', locked_at: null, next_retry_at: null }),
    );
  });

  it('reprogramme un échec avec le backoff du premier essai', async () => {
    const finalUpdate = fakeChain({ data: null, error: null });
    stubSequence([
      fakeChain({ data: [], error: null }),
      fakeChain({ data: [ROW], error: null }),
      fakeChain({ data: [], error: null }),
      fakeChain({ data: { id: ROW.id }, error: null }),
      finalUpdate,
    ]);
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new Error('timeout Resend'));

    const result = await runContactRetries(NOW);

    expect(result.failed).toBe(1);
    expect(finalUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        attempts: 1,
        next_retry_at: new Date(NOW.getTime() + 5 * 60 * 1000).toISOString(),
        error: 'timeout Resend',
      }),
    );
  });

  it('épuise les tentatives sans reprogrammer', async () => {
    const finalUpdate = fakeChain({ data: null, error: null });
    stubSequence([
      fakeChain({ data: [], error: null }),
      fakeChain({ data: [{ ...ROW, attempts: CONTACT_MAX_ATTEMPTS - 1 }], error: null }),
      fakeChain({ data: [], error: null }),
      fakeChain({ data: { id: ROW.id }, error: null }),
      finalUpdate,
    ]);
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new Error('401'));

    const result = await runContactRetries(NOW);

    expect(result.exhausted).toBe(1);
    expect(finalUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: CONTACT_MAX_ATTEMPTS,
        next_retry_at: null,
        error: expect.stringContaining('Tentatives épuisées'),
      }),
    );
  });

  it('récupère les verrous abandonnés', async () => {
    stubSequence([
      fakeChain({ data: [{ id: 'msg-stale' }], error: null }),
      fakeChain({ data: [], error: null }),
      fakeChain({ data: [], error: null }),
    ]);

    const result = await runContactRetries(NOW);

    expect(result.reclaimed).toBe(1);
  });
});
