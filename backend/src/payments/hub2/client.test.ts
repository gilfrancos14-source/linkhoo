import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hub2Config } from '../types';
import { Hub2Error, hub2Request } from './client';

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('hub2Request', () => {
  it('renvoie le corps JSON et pose les en-têtes d’authentification', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await hub2Request<{ ok: boolean }>(CONFIG, '/payment-intents/pi_1');

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.hub2.io/payment-intents/pi_1');
    const headers = init.headers as Record<string, string>;
    expect(headers).toMatchObject({
      ApiKey: 'sk_test_123',
      MerchantId: 'merchant_123',
      Environment: 'sandbox',
    });
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('sérialise le corps des POST', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'x' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await hub2Request(CONFIG, '/payment-links', { method: 'POST', body: { amount: 500 } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ amount: 500 });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('transforme une erreur HTTP en Hub2Error structurée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ message: 'Unauthorized', code: 'AUTH_FAILED', details: { hint: 'key' } }, 401),
      ),
    );

    await expect(hub2Request(CONFIG, '/payment-links')).rejects.toMatchObject({
      name: 'Hub2Error',
      status: 401,
      code: 'AUTH_FAILED',
      message: 'Unauthorized',
    });
  });

  it('tolère un corps d’erreur non JSON (proxy)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })),
    );

    await expect(hub2Request(CONFIG, '/payment-links')).rejects.toMatchObject({
      status: 502,
      code: 'HUB2_HTTP_502',
    });
  });

  it('signale une erreur réseau', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(hub2Request(CONFIG, '/payment-links')).rejects.toMatchObject({
      code: 'HUB2_NETWORK_ERROR',
      status: null,
    });
  });

  it('interrompt un appel trop lent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      ),
    );

    await expect(
      hub2Request({ ...CONFIG, timeoutMs: 10 }, '/payment-links'),
    ).rejects.toMatchObject({ code: 'HUB2_TIMEOUT' });
  });

  it('rejoue un GET sur 5xx quand c’est demandé', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse({ id: 'pi_1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await hub2Request(CONFIG, '/payment-intents/pi_1', { retryOnTransient: true });

    expect(result).toEqual({ id: 'pi_1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ne rejoue jamais un POST par défaut', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'boom' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      hub2Request(CONFIG, '/payment-links', { method: 'POST', body: {} }),
    ).rejects.toBeInstanceOf(Hub2Error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuse un chemin sans slash initial', async () => {
    await expect(hub2Request(CONFIG, 'payment-links')).rejects.toMatchObject({
      code: 'HUB2_INVALID_PATH',
    });
  });
});
