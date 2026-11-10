import { afterEach, describe, expect, it, vi } from 'vitest';
import { PawapayApiError, PawapayClient } from './client';
import type { PawapayConfig } from './types';

const CONFIG: PawapayConfig = {
  baseUrl: 'https://api.sandbox.pawapay.io',
  apiKey: 'api-key-test',
  merchantId: 'merchant-test',
  environment: 'sandbox',
  verifyCallbacks: false,
  timeoutMs: 5_000,
  checkoutTtlMinutes: 30,
  applyEvents: false,
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

describe('PawapayClient', () => {
  it('envoie le Bearer et n’ajoute pas d’en-tête marchand non documenté', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ checkoutId: 'c-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new PawapayClient(CONFIG);
    await client.createCheckout({
      checkoutId: 'c-1',
      returnUrl: 'https://app.example.com/retour',
      countries: ['CIV'],
      amounts: [{ country: 'CIV', currency: 'XOF', amount: '1000' }],
      expiresAfter: 30,
      reason: { fr: 'Reservation', en: 'Reservation' },
      clientReferenceId: 'PAY-1',
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sandbox.pawapay.io/v2/checkouts');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer api-key-test');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Merchant-Id']).toBeUndefined();
  });

  it('réessaie une erreur 5xx puis réussit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ checkoutId: 'c-2' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new PawapayClient(CONFIG);
    await expect(
      client.getCheckoutStatus('c-2'),
    ).resolves.toEqual({ checkoutId: 'c-2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ne réessaie pas une erreur 4xx', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'bad' }, 400));
    vi.stubGlobal('fetch', fetchMock);

    const client = new PawapayClient(CONFIG);
    await expect(client.getCheckoutStatus('c-3')).rejects.toMatchObject({
      name: 'PawapayApiError',
      statusCode: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(client.getCheckoutStatus('c-3')).rejects.toBeInstanceOf(PawapayApiError);
  });

  it('récupère les clés publiques pawaPay', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ id: 'HTTP_EC_P256_KEY:1', key: '-----BEGIN PUBLIC KEY-----' }]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const keys = await new PawapayClient(CONFIG).getPublicKeys();
    expect(keys).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://api.sandbox.pawapay.io/v2/public-key/http');
  });
});
