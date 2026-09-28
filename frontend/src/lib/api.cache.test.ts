import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cachedGet, clearApiCache, request } from './api';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  clearApiCache();
  fetchMock.mockReset();
  // Un `Response` ne peut être lu qu'une fois : on en crée un par appel.
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([{ id: '1' }])));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cachedGet', () => {
  it('déduplique les appels simultanés : une seule requête réseau', async () => {
    const [a, b, c] = await Promise.all([
      cachedGet('/rooms?market=CI'),
      cachedGet('/rooms?market=CI'),
      cachedGet('/rooms?market=CI'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual([{ id: '1' }]);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('traite chaque chemin comme une entrée distincte', async () => {
    await Promise.all([cachedGet('/banners?market=CI'), cachedGet('/events?market=CI')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejoue la requête après expiration du TTL', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await cachedGet('/popular');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1_000_000 + 59_000);
    await cachedGet('/popular');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1_000_000 + 61_000);
    await cachedGet('/popular');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ne met jamais en cache une erreur', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    await expect(cachedGet('/flaky')).rejects.toThrow('boom');

    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));
    await cachedGet('/flaky');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('force une revalidation HTTP (cache: no-cache) pour ne jamais servir de donnée périmée', async () => {
    await cachedGet('/banners?market=CI');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/banners?market=CI',
      expect.objectContaining({ cache: 'no-cache' })
    );
  });

  it('invalide le cache complet après une mutation', async () => {
    await cachedGet('/rooms?market=CI');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await request('/rooms', { method: 'POST', body: JSON.stringify({ title: 'x' }) });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await cachedGet('/rooms?market=CI');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('conserve une promesse unique en cas d’échec partagé (pas de requête en rafale)', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const results = await Promise.allSettled([cachedGet('/x'), cachedGet('/x')]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
  });
});
