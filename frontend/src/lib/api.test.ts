import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Chaque test recharge un module neuf : authTokenGetter et le cache public
// sont de l'état mutable du module, ils ne doivent pas fuser d'un test à l'autre.
let api: typeof import('./api');

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch non appelé');
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

function lastHeaders(): Record<string, string> {
  return (lastCall().init.headers ?? {}) as Record<string, string>;
}

function lastBody(): unknown {
  const body = lastCall().init.body;
  if (typeof body !== 'string') throw new Error(`corps inattendu: ${typeof body}`);
  return JSON.parse(body);
}

function roomInput(): Parameters<typeof api.apiRooms.create>[0] {
  return {
    title: 'Chambre vue mer',
    subtitle: 'Cocody',
    info: '2 pers.',
    price: '50 000 FCFA',
    price_num: 50000,
    price_unit: 'nuit',
    img: '/images/chambre.jpg',
    alt: 'Chambre',
    images: [],
    description: ' Belle chambre',
    capacity: '2 personnes',
    category: 'standard',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    date_dispo: '2030-01-01',
    conditions: 'Aucune',
  };
}

function reservationInput(): Parameters<typeof api.apiReservations.create>[0] {
  return {
    client_name: 'Aya Koffi',
    client_email: 'aya@example.com',
    client_phone: '+2250700000000',
    room_id: 'room-1',
    room_title: 'Chambre vue mer',
    date_debut: '2030-02-01',
    date_fin: '2030-02-05',
    duree_nombre: 4,
    duree_unite: 'nuit',
    montant: 200000,
    message: 'Arrivée tardive',
  };
}

beforeEach(async () => {
  vi.resetModules();
  api = await import('./api');
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('setAuthTokenGetter / en-tête Authorization', () => {
  it("n'envoie aucun Authorization quand aucun getter n'est enregistré", async () => {
    await api.apiRooms.listMine();

    expect(lastHeaders().Authorization).toBeUndefined();
    expect(lastCall().url).toBe('/api/rooms/mine');
  });

  it('envoie Authorization: Bearer <jeton> quand le getter renvoie un jeton', async () => {
    api.setAuthTokenGetter(async () => 'jwt-abc');

    await api.apiRooms.listMine();

    expect(lastHeaders()).toMatchObject({
      Authorization: 'Bearer jwt-abc',
      'Content-Type': 'application/json',
    });
  });

  it("n'envoie pas Authorization quand le getter renvoie null", async () => {
    api.setAuthTokenGetter(async () => null);

    await api.apiAuth.me();

    expect(lastHeaders().Authorization).toBeUndefined();
  });

  it('réinterroge le getter à chaque requête (jeton rafraîchi)', async () => {
    let counter = 0;
    api.setAuthTokenGetter(async () => `jeton-${++counter}`);

    await api.apiAuth.me();
    expect(lastHeaders().Authorization).toBe('Bearer jeton-1');

    await api.apiAuth.me();
    expect(lastHeaders().Authorization).toBe('Bearer jeton-2');
  });
});

describe('request', () => {
  it('préfixe le chemin par /api et renvoie le corps JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, value: 42 }));

    const result = await api.request<{ ok: boolean; value: number }>('/ping');

    expect(lastCall().url).toBe('/api/ping');
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('pose Content-Type: application/json par défaut', async () => {
    await api.request('/ping');

    expect(lastHeaders()).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('fusionne les en-têtes personnalisés avec les en-têtes par défaut', async () => {
    await api.request('/ping', { headers: { 'X-Traçage': 'valeur' } });

    expect(lastHeaders()).toMatchObject({
      'Content-Type': 'application/json',
      'X-Traçage': 'valeur',
    });
  });

  it("utilise AbortSignal.timeout(REQUEST_TIMEOUT_MS) quand aucun signal n'est fourni", async () => {
    const signal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);

    await api.request('/lent');

    expect(timeoutSpy).toHaveBeenCalledWith(api.REQUEST_TIMEOUT_MS);
    expect(lastCall().init.signal).toBe(signal);
  });

  it("transmet tel quel un signal d'annulation fourni par l'appelant", async () => {
    const controller = new AbortController();

    await api.request('/annulable', { signal: controller.signal });

    expect(lastCall().init.signal).toBe(controller.signal);
  });

  it('transforme une erreur de délai en message explicite', async () => {
    const timeout = new Error('The operation was aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValueOnce(timeout);

    await expect(api.request('/lent')).rejects.toThrow(
      'Délai dépassé. Vérifiez votre connexion puis réessayez.',
    );
  });

  it('propage une erreur réseau non liée au délai', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Echec DNS'));

    await expect(api.request('/ping')).rejects.toThrow('Echec DNS');
  });

  it("throw le message du corps sur un statut d'erreur", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Champ requis' }, 400));

    await expect(api.request('/ping', { method: 'POST' })).rejects.toThrow('Champ requis');
  });

  it("throw 'API error <status>' quand le corps n'a pas de message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'autre clé' }, 404));

    await expect(api.request('/ping')).rejects.toThrow('API error 404');
  });

  it("throw 'API error <status>' sur un corps non JSON ou vide", async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>500</html>', { status: 500 }));

    await expect(api.request('/ping')).rejects.toThrow('API error 500');

    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));

    await expect(api.request('/ping')).rejects.toThrow('API error 503');
  });

  it('ne lit pas le corps d’une réponse 204 (DELETE sans contenu)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.request('/ping', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});

describe('parseJsonBody', () => {
  it('retourne undefined sur une 204', async () => {
    const res = new Response(null, { status: 204 });

    await expect(api.parseJsonBody(res)).resolves.toBeUndefined();
  });

  it('retourne undefined sur une 205', async () => {
    const res = new Response(null, { status: 205 });

    await expect(api.parseJsonBody(res)).resolves.toBeUndefined();
  });

  it('retourne undefined sur un corps vide', async () => {
    const res = new Response('', { status: 200 });

    await expect(api.parseJsonBody(res)).resolves.toBeUndefined();
  });

  it('parse un corps JSON valide', async () => {
    const res = jsonResponse({ id: '7', title: 'Chambre' });

    await expect(api.parseJsonBody(res)).resolves.toEqual({ id: '7', title: 'Chambre' });
  });

  it('laisse remonter l’erreur de parsing sur un corps invalide', async () => {
    const res = new Response('{oops', { status: 200 });

    await expect(api.parseJsonBody(res)).rejects.toThrow(SyntaxError);
  });
});

describe('apiRooms', () => {
  it('list(market) interroge /rooms?market=… via le cache public', async () => {
    await api.apiRooms.list('CI');

    const { url, init } = lastCall();
    expect(url).toBe('/api/rooms?market=CI');
    expect(init.cache).toBe('no-cache');
  });

  it('list() sans marché interroge /rooms', async () => {
    await api.apiRooms.list();

    expect(lastCall().url).toBe('/api/rooms');
  });

  it('list(..., { fresh: true }) contourne le cache mémoire', async () => {
    await api.apiRooms.list('CI');
    await api.apiRooms.list('CI', { fresh: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastCall().url).toBe('/api/rooms?market=CI');
  });

  it('listMine interroge /rooms/mine', async () => {
    await api.apiRooms.listMine();

    const { url, init } = lastCall();
    expect(url).toBe('/api/rooms/mine');
    // Aucun `method` explicite = GET par défaut de fetch.
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('getPopular interroge /rooms/popular?market=…', async () => {
    await api.apiRooms.getPopular('BJ');

    expect(lastCall().url).toBe('/api/rooms/popular?market=BJ');
  });

  it('listAvailable construit la requête avec les dates et encode la ville', async () => {
    await api.apiRooms.listAvailable('CI', '2030-02-01', '2030-02-05', 'Abidjan Plateau');

    expect(lastCall().url).toBe(
      '/api/rooms/available?market=CI&arrivee=2030-02-01&depart=2030-02-05&ville=Abidjan%20Plateau',
    );
  });

  it('listAvailable omet le paramètre ville quand il est absent', async () => {
    await api.apiRooms.listAvailable('BJ', '2030-02-01', '2030-02-05');

    expect(lastCall().url).toBe(
      '/api/rooms/available?market=BJ&arrivee=2030-02-01&depart=2030-02-05',
    );
  });

  it('get interroge /rooms/:id', async () => {
    await api.apiRooms.get('42');

    expect(lastCall().url).toBe('/api/rooms/42');
  });

  it('villes construit les deux variantes de chemin', async () => {
    await api.apiRooms.villes();
    expect(lastCall().url).toBe('/api/rooms/villes');

    await api.apiRooms.villes('BJ');
    expect(lastCall().url).toBe('/api/rooms/villes?market=BJ');
  });

  it('create POST /rooms avec le corps sérialisé', async () => {
    const payload = roomInput();

    await api.apiRooms.create(payload);

    expect(lastCall().init.method).toBe('POST');
    expect(lastCall().url).toBe('/api/rooms');
    expect(lastBody()).toEqual(payload);
  });

  it('update PUT /rooms/:id avec le corps sérialisé', async () => {
    await api.apiRooms.update('7', { title: 'Nouveau titre' });

    const { url, init } = lastCall();
    expect(url).toBe('/api/rooms/7');
    expect(init.method).toBe('PUT');
    expect(lastBody()).toEqual({ title: 'Nouveau titre' });
  });

  it('delete DELETE /rooms/:id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.apiRooms.delete('7')).resolves.toBeUndefined();

    expect(lastCall().url).toBe('/api/rooms/7');
    expect(lastCall().init.method).toBe('DELETE');
  });

  it('toggle PATCH /rooms/:id/toggle', async () => {
    await api.apiRooms.toggle('7');

    expect(lastCall().url).toBe('/api/rooms/7/toggle');
    expect(lastCall().init.method).toBe('PATCH');
  });

  it('propage le message du serveur quand la suppression échoue', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Réservation liée' }, 409));

    await expect(api.apiRooms.delete('7')).rejects.toThrow('Réservation liée');
  });
});

describe('apiBanners / apiEvents', () => {
  it('apiBanners.list avec marché', async () => {
    await api.apiBanners.list('CI');

    expect(lastCall().url).toBe('/api/banners?market=CI');
  });

  it('apiBanners.list sans marché', async () => {
    await api.apiBanners.list();

    expect(lastCall().url).toBe('/api/banners');
  });

  it('apiEvents.list exige le marché dans la query', async () => {
    await api.apiEvents.list('BJ');

    expect(lastCall().url).toBe('/api/events?market=BJ');
  });
});

describe('apiReservations', () => {
  it('list GET /reservations', async () => {
    await api.apiReservations.list();

    expect(lastCall().url).toBe('/api/reservations');
    expect(lastCall().init.method ?? 'GET').toBe('GET');
  });

  it('listMine GET /reservations/mine', async () => {
    await api.apiReservations.listMine();

    expect(lastCall().url).toBe('/api/reservations/mine');
  });

  it('cancelMine POST /reservations/:id/cancel', async () => {
    await api.apiReservations.cancelMine('res-1');

    expect(lastCall().url).toBe('/api/reservations/res-1/cancel');
    expect(lastCall().init.method).toBe('POST');
  });

  it('create POST /reservations avec les données du client', async () => {
    const payload = reservationInput();

    await api.apiReservations.create(payload);

    expect(lastCall().url).toBe('/api/reservations');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual(payload);
  });

  it('updateStatut PATCH /reservations/:id avec { statut }', async () => {
    await api.apiReservations.updateStatut('res-1', 'confirmee');

    expect(lastCall().url).toBe('/api/reservations/res-1');
    expect(lastCall().init.method).toBe('PATCH');
    expect(lastBody()).toEqual({ statut: 'confirmee' });
  });

  it('checkConflict construit la query sans exclude_id', async () => {
    await api.apiReservations.checkConflict('room-1', '2030-02-01', '2030-02-05');

    expect(lastCall().url).toBe(
      '/api/reservations/check?room_id=room-1&date_debut=2030-02-01&date_fin=2030-02-05',
    );
  });

  it('checkConflict ajoute exclude_id quand il est fourni', async () => {
    await api.apiReservations.checkConflict('room-1', '2030-02-01', '2030-02-05', 'res-9');

    expect(lastCall().url).toBe(
      '/api/reservations/check?room_id=room-1&date_debut=2030-02-01&date_fin=2030-02-05&exclude_id=res-9',
    );
  });
});

describe('apiNewsletter', () => {
  it('subscribe POST /newsletter avec l’email', async () => {
    await api.apiNewsletter.subscribe({ email: 'aya@example.com' });

    expect(lastCall().url).toBe('/api/newsletter');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual({ email: 'aya@example.com' });
  });

  it('subscribe transmet le marché quand il est renseigné', async () => {
    await api.apiNewsletter.subscribe({ email: 'aya@example.com', market: 'BJ' });

    expect(lastBody()).toEqual({ email: 'aya@example.com', market: 'BJ' });
  });
});

describe('apiNotifications', () => {
  it('listAdmin GET /notifications', async () => {
    await api.apiNotifications.listAdmin();

    expect(lastCall().url).toBe('/api/notifications');
  });

  it('listClient GET /notifications/client', async () => {
    await api.apiNotifications.listClient();

    expect(lastCall().url).toBe('/api/notifications/client');
  });

  it('markRead PATCH /notifications/:id/read', async () => {
    await api.apiNotifications.markRead('n-1');

    expect(lastCall().url).toBe('/api/notifications/n-1/read');
    expect(lastCall().init.method).toBe('PATCH');
  });

  it('markReadClient PATCH /notifications/client/:id/read', async () => {
    await api.apiNotifications.markReadClient('n-2');

    expect(lastCall().url).toBe('/api/notifications/client/n-2/read');
    expect(lastCall().init.method).toBe('PATCH');
  });

  it('createClient POST /notifications/client avec le corps', async () => {
    const payload = { client_id: 'c-1', title: 'Réservation confirmée' };

    await api.apiNotifications.createClient(payload);

    expect(lastCall().url).toBe('/api/notifications/client');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual(payload);
  });
});

describe('apiUpload', () => {
  it('envoie le fichier en FormData sur /upload avec le jeton', async () => {
    api.setAuthTokenGetter(async () => 'jwt-upload');
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: '/u/f.jpg', path: 'f.jpg' }));
    const file = new File(['binaire'], 'photo.jpg', { type: 'image/jpeg' });

    const result = await api.apiUpload.upload(file, 'rooms');

    const { url, init } = lastCall();
    expect(url).toBe('/api/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('bucket')).toBe('rooms');
    expect(lastHeaders()).toMatchObject({ Authorization: 'Bearer jwt-upload' });
    // Le Content-Type doit rester libre pour que le navigateur ajoute le boundary.
    expect(lastHeaders()['Content-Type']).toBeUndefined();
    expect(result).toEqual({ url: '/u/f.jpg', path: 'f.jpg' });
  });

  it("omet le champ bucket quand aucun bucket n'est fourni", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: '/u/f.jpg', path: 'f.jpg' }));

    await api.apiUpload.upload(new File(['x'], 'f.txt'));

    const form = lastCall().init.body as FormData;
    expect(form.get('bucket')).toBeNull();
    expect(form.has('file')).toBe(true);
  });

  it("n'ajoute Authorization sans jeton", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: '/u/f.jpg', path: 'f.jpg' }));

    await api.apiUpload.upload(new File(['x'], 'f.txt'));

    expect(lastHeaders().Authorization).toBeUndefined();
  });

  it("throw le message du serveur quand l'upload est refusé", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Fichier trop volumineux' }, 413));

    await expect(api.apiUpload.upload(new File(['x'], 'f.txt'))).rejects.toThrow(
      'Fichier trop volumineux',
    );
  });

  it("throw 'Upload failed' sur une erreur sans message", async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(api.apiUpload.upload(new File(['x'], 'f.txt'))).rejects.toThrow('Upload failed');
  });

  it("throw 'Upload failed: réponse vide' quand l'url manque", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ path: 'f.txt' }));

    await expect(api.apiUpload.upload(new File(['x'], 'f.txt'))).rejects.toThrow(
      'Upload failed: réponse vide',
    );
  });
});

describe('apiGerants', () => {
  it('getMe GET /gerants/me', async () => {
    await api.apiGerants.getMe();

    expect(lastCall().url).toBe('/api/gerants/me');
  });

  it('updateMe PATCH /gerants/me avec le corps', async () => {
    await api.apiGerants.updateMe({ nom: 'Koffi', phone: '+2250102030405' });

    expect(lastCall().url).toBe('/api/gerants/me');
    expect(lastCall().init.method).toBe('PATCH');
    expect(lastBody()).toEqual({ nom: 'Koffi', phone: '+2250102030405' });
  });

  it('deleteDocument DELETE /gerants/:id/documents/:docId', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.apiGerants.deleteDocument('g-1', 'd-1')).resolves.toBeUndefined();

    expect(lastCall().url).toBe('/api/gerants/g-1/documents/d-1');
    expect(lastCall().init.method).toBe('DELETE');
  });

  it('submitVerification POST /gerants/:id/submit-verification', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ transaction_id: 9, payment_url: '/pay' }));

    const result = await api.apiGerants.submitVerification('g-1');

    expect(lastCall().url).toBe('/api/gerants/g-1/submit-verification');
    expect(lastCall().init.method).toBe('POST');
    expect(result).toEqual({ transaction_id: 9, payment_url: '/pay' });
  });

  it('setPropertyAddress envoie maps_url, lat et lng quand ils sont fournis', async () => {
    await api.apiGerants.setPropertyAddress('g-1', 'https://maps/x', 5.3, -4.0);

    expect(lastCall().url).toBe('/api/gerants/g-1/property-address');
    expect(lastCall().init.method).toBe('PATCH');
    expect(lastBody()).toEqual({ maps_url: 'https://maps/x', lat: 5.3, lng: -4.0 });
  });

  it("setPropertyAddress n'envoie que maps_url sans coordonnées", async () => {
    await api.apiGerants.setPropertyAddress('g-1', 'https://maps/x');

    expect(lastBody()).toEqual({ maps_url: 'https://maps/x' });
  });

  it('confirmVerification POST avec transaction_id', async () => {
    await api.apiGerants.confirmVerification('g-1', 42);

    expect(lastCall().url).toBe('/api/gerants/g-1/confirm-verification');
    expect(lastBody()).toEqual({ transaction_id: 42 });
  });

  it('getVerificationStatus GET /gerants/:id/verification-status', async () => {
    await api.apiGerants.getVerificationStatus('g-1');

    expect(lastCall().url).toBe('/api/gerants/g-1/verification-status');
  });
});

describe('apiPremium', () => {
  it('initiate POST /premium/initiate avec le marché', async () => {
    await api.apiPremium.initiate('BJ');

    expect(lastCall().url).toBe('/api/premium/initiate');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual({ market: 'BJ' });
  });

  it('confirm POST /premium/confirm avec transaction_id', async () => {
    await api.apiPremium.confirm(1234);

    expect(lastCall().url).toBe('/api/premium/confirm');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual({ transaction_id: 1234 });
  });
});

describe('apiAuth', () => {
  it('me GET /auth/me', async () => {
    await api.apiAuth.me();

    expect(lastCall().url).toBe('/api/auth/me');
    expect(lastCall().init.method ?? 'GET').toBe('GET');
  });

  it('bootstrap POST /auth/bootstrap avec rôle et marché', async () => {
    await api.apiAuth.bootstrap({ role: 'gerant', market: 'BJ' });

    expect(lastCall().url).toBe('/api/auth/bootstrap');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual({ role: 'gerant', market: 'BJ' });
  });

  it('bootstrap omet le marché quand il n’est pas renseigné', async () => {
    await api.apiAuth.bootstrap({ role: 'client' });

    expect(lastBody()).toEqual({ role: 'client' });
  });
});

describe('apiClients', () => {
  it('getMe GET /clients/me', async () => {
    await api.apiClients.getMe();

    expect(lastCall().url).toBe('/api/clients/me');
  });

  it('create POST /clients avec le corps', async () => {
    const payload = { clerk_user_id: 'ck_1', email: 'aya@example.com', nom: 'Koffi' };

    await api.apiClients.create(payload);

    expect(lastCall().url).toBe('/api/clients');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual(payload);
  });

  it('updateMe PATCH /clients/me avec le corps', async () => {
    await api.apiClients.updateMe({ prenom: 'Aya', telephone: '+2250102030405' });

    expect(lastCall().url).toBe('/api/clients/me');
    expect(lastCall().init.method).toBe('PATCH');
    expect(lastBody()).toEqual({ prenom: 'Aya', telephone: '+2250102030405' });
  });
});

describe('apiReviews', () => {
  it('listByRoom GET /reviews?room_id=…', async () => {
    await api.apiReviews.listByRoom('room-1');

    expect(lastCall().url).toBe('/api/reviews?room_id=room-1');
  });

  it('listByRoom encode les identifiants contenant des caractères réservés', async () => {
    await api.apiReviews.listByRoom('salle 7/a&b');

    expect(lastCall().url).toBe('/api/reviews?room_id=salle%207%2Fa%26b');
  });

  it('listMine GET /reviews/mine', async () => {
    await api.apiReviews.listMine();

    expect(lastCall().url).toBe('/api/reviews/mine');
  });

  it('featured GET /reviews/featured via le cache public', async () => {
    await api.apiReviews.featured();

    const { url, init } = lastCall();
    expect(url).toBe('/api/reviews/featured');
    expect(init.cache).toBe('no-cache');
  });

  it('create POST /reviews avec la note et le commentaire', async () => {
    const payload = {
      reservation_id: 'res-1',
      note_appartement: 4,
      note_gerant: 5,
      commentaire: 'Excellent séjour',
    };

    await api.apiReviews.create(payload);

    expect(lastCall().url).toBe('/api/reviews');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual(payload);
  });

  it('create omet le commentaire absent', async () => {
    await api.apiReviews.create({
      reservation_id: 'res-1',
      note_appartement: 3,
      note_gerant: 3,
    });

    expect(lastBody()).toEqual({
      reservation_id: 'res-1',
      note_appartement: 3,
      note_gerant: 3,
    });
  });
});

describe("propagation d'erreurs par namespace", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ['apiRooms.get', () => api.apiRooms.get('1')],
    ['apiBanners.list', () => api.apiBanners.list('CI')],
    ['apiEvents.list', () => api.apiEvents.list('CI')],
    ['apiReservations.list', () => api.apiReservations.list()],
    ['apiReservations.create', () => api.apiReservations.create(reservationInput())],
    ['apiNewsletter.subscribe', () => api.apiNewsletter.subscribe({ email: 'a@b.ci' })],
    ['apiNotifications.listAdmin', () => api.apiNotifications.listAdmin()],
    ['apiGerants.getMe', () => api.apiGerants.getMe()],
    ['apiPremium.initiate', () => api.apiPremium.initiate('CI')],
    ['apiAuth.me', () => api.apiAuth.me()],
    ['apiAuth.bootstrap', () => api.apiAuth.bootstrap({ role: 'client' })],
    ['apiClients.getMe', () => api.apiClients.getMe()],
    ['apiReviews.listMine', () => api.apiReviews.listMine()],
    ['apiReviews.featured', () => api.apiReviews.featured()],
  ];

  it.each(cases)('%s rejette avec le message renvoyé par le serveur', async (_name, call) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom serveur' }, 500));

    await expect(call()).rejects.toThrow('boom serveur');
  });

  it.each(cases)('%s rejette avec API error <status> sans message', async (_name, call) => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 502 }));

    await expect(call()).rejects.toThrow('API error 502');
  });
});
