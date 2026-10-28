import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import hub2WebhookRouter from './hub2Webhook';
import { supabaseAdmin } from '../config/supabase';
import { computeSignature } from '../payments/hub2/webhooks';
import {
  buildTestApp,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const app = buildTestApp('/api/webhooks/hub2', hub2WebhookRouter, { captureRawBody: true });

const SECRET = 'whsec_test_123';
const BODY = JSON.stringify({
  id: 'evt_123',
  type: 'payment_intent.succeeded',
  createdAt: '2026-10-27T10:00:00.000Z',
  data: { id: 'pi_123', purchaseReference: 'PAY-2026-ABC123' },
});

const HUB2_ENV: Record<string, string> = {
  HUB2_API_KEY: 'sk_test_123',
  HUB2_MERCHANT_ID: 'merchant_123',
  HUB2_ENV: 'sandbox',
  HUB2_WEBHOOK_SECRET: SECRET,
  PAYMENTS_APPLY_EVENTS: 'false',
};

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...HUB2_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function signatureHeader(body: string, secondsAgo = 0): string {
  const s0 = String(Math.floor(Date.now() / 1000) - secondsAgo);
  return `s1=${computeSignature(SECRET, s0, body)},s0=${s0}`;
}

function mockEventTables(insert: FakeChain, update: FakeChain = fakeChain({ data: null, error: null })): void {
  useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
    payment_events: [insert, update],
  });
}

function post(body: string, header: string | null = signatureHeader(body)) {
  const req = request(app).post('/api/webhooks/hub2').set('Content-Type', 'application/json');
  if (header !== null) req.set('Hub2-Signature', header);
  return req.send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  for (const key of Object.keys(HUB2_ENV)) delete process.env[key];
});

describe('POST /api/webhooks/hub2', () => {
  it('répond 503 quand Hub2 n’est pas configuré', async () => {
    setEnv({ HUB2_API_KEY: undefined });
    const response = await post(BODY);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Paiement indisponible');
  });

  it('répond 503 quand le secret webhook est absent', async () => {
    setEnv({ HUB2_WEBHOOK_SECRET: undefined });
    const response = await post(BODY);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Webhook non configuré');
  });

  it('refuse une requête sans signature', async () => {
    const response = await post(BODY, null);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Signature invalide');
  });

  it('refuse une signature invalide', async () => {
    const response = await post(BODY, 's1=deadbeef,s0=' + Math.floor(Date.now() / 1000));
    expect(response.status).toBe(400);
  });

  it('refuse un webhook rejoué au-delà de 5 minutes', async () => {
    const response = await post(BODY, signatureHeader(BODY, 600));
    expect(response.status).toBe(400);
  });

  it('stocke l’événement et ne l’applique pas en mode observation', async () => {
    const insert = fakeChain({ data: { id: 'evt-row-1' }, error: null });
    const update = fakeChain({ data: null, error: null });
    mockEventTables(insert, update);

    const response = await post(BODY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, applied: false });
    expect(insert.insert).toHaveBeenCalledWith({
      provider: 'hub2',
      provider_event_id: 'evt_123',
      event_type: 'payment_intent.succeeded',
      payload: expect.objectContaining({ id: 'evt_123' }),
    });
    expect(update.update).toHaveBeenCalledWith({
      processed_at: expect.any(String),
      processing_error: 'observation_mode',
    });
  });

  it('répond 200 sans réécrire un doublon', async () => {
    const insert = fakeChain({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const update = fakeChain({ data: null, error: null });
    mockEventTables(insert, update);

    const response = await post(BODY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, duplicate: true });
    expect(update.update).not.toHaveBeenCalled();
  });

  it('répond 503 quand la table payment_events n’existe pas', async () => {
    const insert = fakeChain({ data: null, error: { code: '42P01', message: 'undefined table' } });
    mockEventTables(insert);

    const response = await post(BODY);

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Schéma de paiement indisponible');
  });

  it('trace un événement dont le paiement est inconnu sans faire échouer la livraison', async () => {
    setEnv({ PAYMENTS_APPLY_EVENTS: 'true' });
    const insert = fakeChain({ data: { id: 'evt-row-2' }, error: null });
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payment_events: [insert, update],
      payments: fakeChain({ data: null, error: null }),
    });

    const response = await post(BODY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      received: true,
      applied: false,
      reason: 'payment_not_found',
    });
    expect(update.update).toHaveBeenCalledWith({
      processed_at: expect.any(String),
      processing_error: 'payment_not_found',
    });
  });

  it('applique un paiement réussi et marque l’événement traité', async () => {
    setEnv({ PAYMENTS_APPLY_EVENTS: 'true' });
    const insert = fakeChain({ data: { id: 'evt-row-3' }, error: null });
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payment_events: [insert, update],
      payments: fakeChain({
        data: {
          reference: 'PAY-2026-ABC123',
          purpose: 'premium',
          amount: 5000,
          currency: 'XOF',
          status: 'pending',
        },
        error: null,
      }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [{ already_claimed: false }],
      error: null,
    } as never);

    const response = await post(BODY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, applied: true });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('payment_claim_premium', {
      p_reference: 'PAY-2026-ABC123',
      p_provider_payment_id: 'pi_123',
      p_amount: 5000,
      p_currency: 'XOF',
      p_days: 30,
    });
    expect(update.update).toHaveBeenCalledWith({
      processed_at: expect.any(String),
      processing_error: null,
    });
  });

  it('répond 500 et conserve l’événement quand le traitement échoue', async () => {
    setEnv({ PAYMENTS_APPLY_EVENTS: 'true' });
    const insert = fakeChain({ data: { id: 'evt-row-4' }, error: null });
    const update = fakeChain({ data: null, error: null });
    useSupabaseTables((supabaseAdmin as unknown as { from: unknown }).from, {
      payment_events: [insert, update],
      payments: fakeChain({
        data: {
          reference: 'PAY-2026-ABC123',
          purpose: 'premium',
          amount: 5000,
          currency: 'XOF',
          status: 'pending',
        },
        error: null,
      }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    } as never);

    const response = await post(BODY);

    expect(response.status).toBe(500);
    expect(update.update).toHaveBeenCalledWith({ processing_error: 'apply_failed' });
  });

  it('refuse un corps JSON invalide même correctement signé', async () => {
    // Le parseur Express rejette le JSON avant la route : le corps brut n'est
    // alors jamais interprété. Seul le statut compte (Hub2 ne doit pas rejouer).
    const raw = '{not json';
    const response = await post(raw, signatureHeader(raw));
    expect(response.status).toBe(400);
  });
});
