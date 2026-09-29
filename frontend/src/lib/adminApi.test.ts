import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAdmin, getAdminToken, setAdminToken, type AdminData } from './adminApi';
import { clearApiCache } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, clearApiCache: vi.fn() };
});

const clearCacheMock = vi.mocked(clearApiCache);

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function firstCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error('fetch non appelé');
  return { url: String(call[0]), init: call[1] ?? {} };
}

const admin: AdminData = {
  id: 'admin-1',
  email: 'admin@ilehya.ci',
  nom: 'Koffi',
  prenom: 'Aya',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAdminToken(null);
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("état initial du jeton admin", () => {
  it("lit admin_token depuis localStorage au chargement du module", async () => {
    localStorage.setItem('admin_token', 'token-initial');
    vi.resetModules();

    const fresh = await import('./adminApi');

    expect(fresh.getAdminToken()).toBe('token-initial');
    localStorage.removeItem('admin_token');
  });

  it("vaut null quand aucun jeton n'est stocké", async () => {
    localStorage.removeItem('admin_token');
    vi.resetModules();

    const fresh = await import('./adminApi');

    expect(fresh.getAdminToken()).toBeNull();
  });
});

describe('setAdminToken / getAdminToken', () => {
  it('persiste le jeton dans localStorage', () => {
    setAdminToken('jwt-abc');

    expect(localStorage.getItem('admin_token')).toBe('jwt-abc');
    expect(getAdminToken()).toBe('jwt-abc');
  });

  it('supprime la clé quand on déconnecte', () => {
    setAdminToken('jwt-abc');
    setAdminToken(null);

    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(getAdminToken()).toBeNull();
  });
});

describe('apiAdmin.login', () => {
  it('envoie les credentials en JSON sur /api/admin/login', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'jwt-abc', admin }));

    const result = await apiAdmin.login('admin@ilehya.ci', 'secret');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'admin@ilehya.ci', password: 'secret' }));
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(result).toEqual({ token: 'jwt-abc', admin });
  });

  it("n'ajoute pas d'en-tête Authorization sans jeton", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'jwt-abc', admin }));

    await apiAdmin.login('admin@ilehya.ci', 'secret');

    const { init } = firstCall();
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('en-tête Authorization', () => {
  it('envoie le jeton stocké sur les requêtes suivantes', async () => {
    setAdminToken('jwt-admin');
    fetchMock.mockResolvedValueOnce(jsonResponse(admin));

    await apiAdmin.getMe();

    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/me');
    expect((init.headers ?? {}) as Record<string, string>).toMatchObject({
      Authorization: 'Bearer jwt-admin',
      'Content-Type': 'application/json',
    });
  });
});

describe("gestion des erreurs HTTP", () => {
  it("throw new Error(error) sur une 400 avec body {error}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Identifiants invalides' }, 400));

    await expect(apiAdmin.login('a@b.ci', 'bad')).rejects.toThrow('Identifiants invalides');
  });

  it("throw 'API error 500' sur une 500 sans body", async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(apiAdmin.getStats()).rejects.toThrow('API error 500');
  });

  it('transforme un timeout réseau en message explicite', async () => {
    const timeout = new Error('The operation was aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValueOnce(timeout);

    await expect(apiAdmin.getMe()).rejects.toThrow(
      'Délai dépassé. Vérifiez votre connexion puis réessayez.',
    );
  });

  it("propage une erreur réseau non liée au délai", async () => {
    fetchMock.mockRejectedValueOnce(new Error('Echec DNS'));

    await expect(apiAdmin.getMe()).rejects.toThrow('Echec DNS');
  });
});

describe('invalidation du cache public', () => {
  it('appelle clearApiCache après une mutation DELETE', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await apiAdmin.deleteBanner('banner-1');

    expect(clearCacheMock).toHaveBeenCalledTimes(1);
  });

  it('appelle clearApiCache après une création POST', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'event-1' }));

    await apiAdmin.createEvent({
      market: 'CI',
      city: 'Abidjan',
      title: 'Festival',
      description: '',
      event_date: '2030-06-01',
      img: null,
      alt: null,
    });

    expect(clearCacheMock).toHaveBeenCalledTimes(1);
  });

  it('ne touche pas au cache sur un GET', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ gerants: {}, rooms: {}, reservations: {} }));

    await apiAdmin.getStats();

    expect(clearCacheMock).not.toHaveBeenCalled();
  });
});

describe('apiAdmin.uploadFile', () => {
  it('envoie le fichier en FormData et renvoie url + path', async () => {
    setAdminToken('jwt-admin');
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: '/uploads/doc.pdf', path: 'doc.pdf' }));
    const file = new File(['contenu'], 'doc.pdf', { type: 'application/pdf' });

    const result = await apiAdmin.uploadFile(file);

    const { url, init } = firstCall();
    expect(url).toBe('/api/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers ?? {}) as Record<string, string>).toMatchObject({
      Authorization: 'Bearer jwt-admin',
    });
    expect(result).toEqual({ url: '/uploads/doc.pdf', path: 'doc.pdf' });
  });

  it("throw 'Upload failed' sur une erreur sans message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 400));
    const file = new File(['contenu'], 'doc.pdf', { type: 'application/pdf' });

    await expect(apiAdmin.uploadFile(file)).rejects.toThrow('Upload failed');
  });

  it("throw 'Upload failed: réponse vide' quand l'url manque", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: '' }));
    const file = new File(['contenu'], 'doc.pdf', { type: 'application/pdf' });

    await expect(apiAdmin.uploadFile(file)).rejects.toThrow('Upload failed: réponse vide');
  });
});
