import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAdmin, setAdminToken } from './adminApi';
import { clearApiCache } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, clearApiCache: vi.fn() };
});

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setAdminToken(null);
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ items: [], counts: {} })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiAdmin — reversements', () => {
  it('liste les reversements avec les bons paramètres', async () => {
    await apiAdmin.getPayouts({ scope: 'failed', market: 'CI', limit: 20 });

    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toBe('/api/admin/payouts?scope=failed&market=CI&limit=20');
    expect(call[1]?.method).toBeUndefined();
  });

  it('relance un reversement en POST', async () => {
    await apiAdmin.retryPayout('payout-1');

    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toBe('/api/admin/payouts/payout-1/retry');
    expect(call[1]?.method).toBe('POST');
  });

  it('n’envoie aucun paramètre quand aucun filtre n’est demandé', async () => {
    await apiAdmin.getPayouts();

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/admin/payouts');
  });
});
