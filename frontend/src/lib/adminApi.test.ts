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

describe('apiAdmin — endpoints back-office', () => {
  beforeEach(() => {
    setAdminToken('jwt-admin');
  });

  it('getGerants construit la query string market/verification_status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await apiAdmin.getGerants({ market: 'CI', verification_status: 'pending' });
    expect(firstCall().url).toBe('/api/admin/gerants?market=CI&verification_status=pending');
    expect(firstCall().init.method).toBeUndefined();

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiAdmin.getGerants();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/gerants');
  });

  it('getReservations construit la query string statut/search', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await apiAdmin.getReservations({ statut: 'confirmee', search: 'akou' });
    expect(firstCall().url).toBe('/api/admin/reservations?statut=confirmee&search=akou');

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiAdmin.getReservations();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/reservations');
  });

  it('getBanners construit la query string market/section', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await apiAdmin.getBanners('BJ', 'events');
    expect(firstCall().url).toBe('/api/banners?market=BJ&section=events');

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiAdmin.getBanners();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/banners');
  });

  it('getEvents force include_past=1 pour le back-office', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await apiAdmin.getEvents('CI');

    const { url } = firstCall();
    expect(url).toBe('/api/events?market=CI&include_past=1');
  });

  it('changePassword envoie les deux mots de passe en JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

    await apiAdmin.changePassword('ancien', 'nouveau');

    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/change-password');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ currentPassword: 'ancien', newPassword: 'nouveau' }));
  });

  it('reviewDocument PATCH le verdict avec le motif de rejet', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'doc-1', status: 'rejected' }));

    await apiAdmin.reviewDocument('doc-1', 'rejected', 'Photo floue');

    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/documents/doc-1/review');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ status: 'rejected', rejection_reason: 'Photo floue' }));
  });

  it('rejectGerantVerification transmet le motif de refus', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'g1' }));

    await apiAdmin.rejectGerantVerification('g1', 'Pièces incomplètes');

    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/gerants/g1/reject-verification');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ rejection_reason: 'Pièces incomplètes' }));
  });

  it('createBanner envoie les champs de la bannière', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'b1' }));

    await apiAdmin.createBanner({
      section: 'popular',
      img: '/img/a.webp',
      alt: 'Appartement',
      link: '/ci/logement/1',
      market: 'CI',
      order: 1,
    });

    const { url, init } = firstCall();
    expect(url).toBe('/api/banners');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ section: 'popular', market: 'CI', order: 1 });
  });

  it('updateBanner PUT les champs modifiés', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'b1' }));

    await apiAdmin.updateBanner('b1', { alt: 'Nouvel alt', order: 3 });

    const { url, init } = firstCall();
    expect(url).toBe('/api/banners/b1');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ alt: 'Nouvel alt', order: 3 }));
  });

  it('updateEvent PUT les champs modifiés', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'e1' }));

    await apiAdmin.updateEvent('e1', { title: 'Nouveau titre' });

    const { url, init } = firstCall();
    expect(url).toBe('/api/events/e1');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ title: 'Nouveau titre' }));
  });

  it('deleteEvent DELETE la ressource', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await apiAdmin.deleteEvent('e1');

    const { url, init } = firstCall();
    expect(url).toBe('/api/events/e1');
    expect(init.method).toBe('DELETE');
    expect(clearCacheMock).toHaveBeenCalledTimes(1);
  });

  it('getDestinations lit la partition big/small du serveur', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ big: [{ id: 'd1', featured: false }], small: [{ id: 'd2', featured: false }] }),
    );

    const partition = await apiAdmin.getDestinations('BJ');

    expect(firstCall().url).toBe('/api/tourism?market=BJ');
    expect(firstCall().init.method).toBeUndefined();
    expect(partition.big.map((d) => d.id)).toEqual(['d1']);
    expect(partition.small.map((d) => d.id)).toEqual(['d2']);
    expect(clearCacheMock).not.toHaveBeenCalled();
  });

  it('createDestination envoie la destination avec featured', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'd1' }));

    await apiAdmin.createDestination({
      market: 'BJ',
      city: 'Ouidah',
      title: 'Ouidah',
      description: 'Plages et histoire.',
      img: '/images/ouidah.jpg',
      alt: "Plage d'Ouidah",
      featured: true,
    });

    const { url, init } = firstCall();
    expect(url).toBe('/api/tourism');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ city: 'Ouidah', featured: true });
    expect(clearCacheMock).toHaveBeenCalledTimes(1);
  });

  it('updateDestination PUT le checkbox « mettre en avant »', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'd1', featured: true }));

    await apiAdmin.updateDestination('d1', { featured: true });

    const { url, init } = firstCall();
    expect(url).toBe('/api/tourism/d1');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ featured: true }));
  });

  it('deleteDestination DELETE la ressource', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await apiAdmin.deleteDestination('d1');

    const { url, init } = firstCall();
    expect(url).toBe('/api/tourism/d1');
    expect(init.method).toBe('DELETE');
    expect(clearCacheMock).toHaveBeenCalledTimes(1);
  });

  it('les mutations gérant utilisent les verbes PATCH/POST attendus', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'g1' })));

    await apiAdmin.revokeGerantVerification('g1');
    expect(firstCall()).toMatchObject({ url: '/api/admin/gerants/g1/revoke-verification' });
    expect(firstCall().init.method).toBe('PATCH');

    await apiAdmin.startGerantReview('g1');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/gerants/g1/start-review');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH');

    await apiAdmin.approveGerantVerification('g1');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/admin/gerants/g1/approve-verification');
    expect(fetchMock.mock.calls[2][1]?.method).toBe('PATCH');

    await apiAdmin.checkAvailability('res-1');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/admin/reservations/res-1/check-availability');
    expect(fetchMock.mock.calls[3][1]?.method).toBe('POST');
  });

  it('getVerificationDocuments et getNotifications ciblent les bonnes URLs', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    await apiAdmin.getVerificationDocuments('g1');
    expect(firstCall().url).toBe('/api/admin/gerants/g1/documents');

    await apiAdmin.getNotifications();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/notifications');
    expect(fetchMock.mock.calls[1][1]?.method).toBeUndefined();
  });

  it('markNotificationRead PATCH la notification lue', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await apiAdmin.markNotificationRead('n1');

    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/notifications/n1/read');
    expect(init.method).toBe('PATCH');
  });

  it('updateRoomPromoGroup PATCH la promotion de la chambre', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'room-1' }));

    await apiAdmin.updateRoomPromoGroup('room-1', {
      promo_group: 'ete-2026',
      promo_start: '2026-06-01',
      promo_end: '2026-08-31',
    });

    const { url, init } = firstCall();
    expect(url).toBe('/api/admin/rooms/room-1/promo-group');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      promo_group: 'ete-2026',
      promo_start: '2026-06-01',
      promo_end: '2026-08-31',
    });
    expect(clearCacheMock).toHaveBeenCalledTimes(1);
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
