import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hub2Config } from '../types';
import { createTransfer, findTransferByReference, getTransfer } from './transfers';

const CONFIG: Hub2Config = {
  baseUrl: 'https://api.hub2.io',
  apiKey: 'sk_test_123',
  merchantId: 'merchant_123',
  environment: 'sandbox',
  webhookSecret: null,
  timeoutMs: 5_000,
  paymentLinkTtlMinutes: 30,
  applyEvents: false,
};

const DESTINATION = {
  type: 'mobile_money' as const,
  country: 'CI',
  msisdn: '+2250700000000',
  provider: 'orange',
  recipientName: 'Awa Koné',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTransfer', () => {
  it('envoie le corps attendu et traduit le statut Hub2', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          id: 'tr_1',
          reference: 'OUT-ABC-123',
          status: 'successful',
          amount: 120_000,
          currency: 'XOF',
        },
        201,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const transfer = await createTransfer(CONFIG, {
      reference: 'OUT-ABC-123',
      amount: 120_000,
      currency: 'XOF',
      description: 'Reversement séjour resa-1',
      destination: DESTINATION,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.hub2.io/transfers');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      reference: 'OUT-ABC-123',
      amount: 120_000,
      currency: 'XOF',
      description: 'Reversement séjour resa-1',
      destination: DESTINATION,
    });
    expect(transfer).toMatchObject({
      id: 'tr_1',
      reference: 'OUT-ABC-123',
      status: 'paid',
      amount: 120_000,
      currency: 'XOF',
    });
  });

  it('remonte le motif d’échec Hub2', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          id: 'tr_2',
          reference: 'OUT-ABC-124',
          status: 'failed',
          amount: 5_000,
          currency: 'XOF',
          failureCause: { code: 'insufficient_balance', message: 'Solde insuffisant', params: [] },
        }),
      ),
    );

    const transfer = await createTransfer(CONFIG, {
      reference: 'OUT-ABC-124',
      amount: 5_000,
      currency: 'XOF',
      description: 'test',
      destination: DESTINATION,
    });

    expect(transfer).toMatchObject({
      status: 'failed',
      failureCode: 'insufficient_balance',
      failureMessage: 'Solde insuffisant',
    });
  });

  it('retombe sur `processing` pour un statut inconnu', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ id: 'tr_3', reference: 'OUT-ABC-125', status: 'awaiting_confirmation' }),
      ),
    );

    const transfer = await createTransfer(CONFIG, {
      reference: 'OUT-ABC-125',
      amount: 5_000,
      currency: 'XOF',
      description: 'test',
      destination: DESTINATION,
    });

    expect(transfer.status).toBe('processing');
  });

  it('lève quand la réponse n’a pas d’identifiant', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 'successful' })));

    await expect(
      createTransfer(CONFIG, {
        reference: 'OUT-ABC-126',
        amount: 5_000,
        currency: 'XOF',
        description: 'test',
        destination: DESTINATION,
      }),
    ).rejects.toThrow('illisible');
  });
});

describe('getTransfer', () => {
  it('relit un transfert par identifiant', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ id: 'tr_1', reference: 'OUT-ABC-123', status: 'pending' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const transfer = await getTransfer(CONFIG, 'tr_1');

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://api.hub2.io/transfers/tr_1');
    expect(transfer?.status).toBe('scheduled');
  });
});

describe('findTransferByReference', () => {
  it('ne retient que la référence exacte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          { id: 'tr_other', reference: 'OUT-OTHER-1', status: 'successful' },
          { id: 'tr_1', reference: 'OUT-ABC-123', status: 'successful' },
        ]),
      ),
    );

    const transfer = await findTransferByReference(CONFIG, 'OUT-ABC-123');

    expect(transfer?.id).toBe('tr_1');
  });

  it('renvoie null quand aucune référence ne correspond', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([{ id: 'tr_other', reference: 'OUT-OTHER-1', status: 'successful' }])),
    );

    await expect(findTransferByReference(CONFIG, 'OUT-ABC-123')).resolves.toBeNull();
  });
});
