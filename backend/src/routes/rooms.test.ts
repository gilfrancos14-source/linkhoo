import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import roomsRouter from './rooms';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import {
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

const app = buildTestApp('/api/rooms', roomsRouter);

const validRoom = {
  title: 'Studio cocooning',
  price: '25 000 FCFA',
  price_num: 25000,
  price_unit: '/ nuit',
  img: 'https://cdn.example.com/studio.webp',
  images: ['https://cdn.example.com/studio.webp'],
  description: 'Un studio confortable au cœur d’Abidjan',
  category: 'Studio',
  market: 'CI',
  pays: 'Côte d’Ivoire',
  ville: 'Abidjan',
  quartier: 'Cocody',
  chambres: 1,
  douches: 1,
  disponible: true,
  conditions: 'Paiement à l’arrivée',
};

let publicRooms: FakeChain;
let rooms: FakeChain;
let gerants: FakeChain;
let reservations: FakeChain;

type TableName = 'rooms' | 'gerants' | 'reservations';

function stubPublic(chain: FakeChain): void {
  vi.mocked(supabasePublic.from).mockReturnValue(chain as never);
}

/** Deux requêtes simultanées (count puis lignes) reçoivent chacune leur chaîne. */
function stubPublicQueue(chains: FakeChain[]): void {
  let cursor = 0;
  vi.mocked(supabasePublic.from).mockImplementation(() => {
    const chain = chains[Math.min(cursor, chains.length - 1)];
    cursor += 1;
    return chain as never;
  });
}

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>>): void {
  useSupabaseTables(supabaseAdmin.from, {
    rooms,
    gerants,
    reservations,
    ...tables,
  });
}

/** Routage de la table `rooms` sur le client public (le gérant premium est lu côté admin). */
function stubPublicRooms(chains: FakeChain | FakeChain[]): void {
  useSupabaseTables(supabasePublic.from, { rooms: chains });
}

/** Chambres à created_at décroissant (l'ordre organique attendu). */
function roomRows(count: number, premiumFrom: number): any[] {
  const base = Date.parse('2026-01-01T00:00:00.000Z');
  return Array.from({ length: count }, (_, index) => ({
    id: `r${String(index).padStart(2, '0')}`,
    gerant_id: index < premiumFrom ? 'gOrganic' : `gPremium${index}`,
    created_at: new Date(base - index * 60_000).toISOString(),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  publicRooms = fakeChain({ data: [], error: null });
  rooms = fakeChain({ data: null, error: null });
  gerants = fakeChain({ data: { market: 'CI', is_verified: false }, error: null });
  reservations = fakeChain({ data: [], error: null });
  stubPublic(publicRooms);
  stubTables({});
});

describe('GET /api/rooms', () => {
  it('400 sur un marché inconnu', async () => {
    const res = await request(app).get('/api/rooms?market=TG');
    expect(res.status).toBe(400);
  });

  it('200 avec le marché filtré', async () => {
    publicRooms = fakeChain({ data: [{ id: 'r1' }], error: null });
    stubPublic(publicRooms);

    const res = await request(app).get('/api/rooms?market=CI');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'r1', gerant_premium: false }]);
    expect(publicRooms.eq).toHaveBeenCalledWith('market', 'CI');
    expect(publicRooms.range).toHaveBeenCalledWith(0, 999);
  });

  it('400 si prix_min dépasse prix_max', async () => {
    const res = await request(app).get('/api/rooms?prix_min=50000&prix_max=10000');
    expect(res.status).toBe(400);
  });

  it('400 sur des filtres hors bornes (chambres=0, limit=500)', async () => {
    expect((await request(app).get('/api/rooms?chambres=0')).status).toBe(400);
    expect((await request(app).get('/api/rooms?limit=500')).status).toBe(400);
    expect((await request(app).get('/api/rooms?disponible=peut-être')).status).toBe(400);
  });

  it('200 : applique tous les filtres côté serveur sans pagination', async () => {
    publicRooms = fakeChain({ data: [{ id: 'r1' }], error: null });
    stubPublic(publicRooms);

    const res = await request(app).get(
      '/api/rooms?market=CI&ville=Abidjan&quartier=Cocody&category=Studio' +
        '&prix_min=10000&prix_max=50000&chambres=2&disponible=true',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'r1', gerant_premium: false }]);
    expect(publicRooms.eq).toHaveBeenCalledWith('market', 'CI');
    expect(publicRooms.eq).toHaveBeenCalledWith('ville', 'Abidjan');
    expect(publicRooms.eq).toHaveBeenCalledWith('quartier', 'Cocody');
    expect(publicRooms.eq).toHaveBeenCalledWith('category', 'Studio');
    expect(publicRooms.gte).toHaveBeenCalledWith('price_num', 10000);
    expect(publicRooms.lte).toHaveBeenCalledWith('price_num', 50000);
    expect(publicRooms.eq).toHaveBeenCalledWith('chambres', 2);
    expect(publicRooms.eq).toHaveBeenCalledWith('disponible', true);
  });

  it('200 : chambres=3 filtre « 3 et plus » (gte, pas eq)', async () => {
    publicRooms = fakeChain({ data: [], error: null });
    stubPublic(publicRooms);

    const res = await request(app).get('/api/rooms?chambres=3');

    expect(res.status).toBe(200);
    expect(publicRooms.gte).toHaveBeenCalledWith('chambres', 3);
    expect(publicRooms.eq).not.toHaveBeenCalledWith('chambres', 3);
  });

  it('200 paginé : renvoie items/total/page/limit et lit la fenêtre de classement', async () => {
    const countChain = fakeChain({ count: 42, error: null, data: null });
    const rows = roomRows(60, 60);
    const dataChain = fakeChain({ data: rows, error: null });
    stubPublicQueue([countChain, dataChain]);

    const res = await request(app).get('/api/rooms?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(42);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
    // Fenêtre bornée : 3 × la page demandée (20 lignes lues, 10 renvoyées).
    expect(dataChain.range).toHaveBeenCalledWith(0, 59);
    expect(res.body.items).toEqual(rows.slice(10, 20).map((row) => ({ ...row, gerant_premium: false })));
    expect(countChain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  });

  it('200 paginé : les filtres portent aussi sur le compte', async () => {
    const countChain = fakeChain({ count: 3, error: null, data: null });
    const dataChain = fakeChain({ data: [], error: null });
    stubPublicQueue([countChain, dataChain]);

    const res = await request(app).get('/api/rooms?market=CI&ville=Lom%C3%A9&page=1&limit=6');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 3, page: 1, limit: 6 });
    expect(countChain.eq).toHaveBeenCalledWith('market', 'CI');
    expect(countChain.eq).toHaveBeenCalledWith('ville', 'Lomé');
    expect(dataChain.range).toHaveBeenCalledWith(0, 17);
  });

  it('200 paginé : limit seul démarre à la page 1', async () => {
    const countChain = fakeChain({ count: 7, error: null, data: null });
    const dataChain = fakeChain({ data: [], error: null });
    stubPublicQueue([countChain, dataChain]);

    const res = await request(app).get('/api/rooms?limit=6');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(dataChain.range).toHaveBeenCalledWith(0, 17);
  });

  it('200 : marque gerant_premium pour un gérant premium actif', async () => {
    const rows = roomRows(3, 3).map((row, index) => ({ ...row, gerant_id: `g${index}` }));
    const gerantsChain = fakeChain({
      data: [{ clerk_user_id: 'g1', is_premium: true, premium_expires_at: null }],
      error: null,
    });
    stubPublicRooms(fakeChain({ data: rows, error: null }));
    stubTables({ gerants: gerantsChain });

    const res = await request(app).get('/api/rooms?market=CI');

    expect(res.status).toBe(200);
    expect(gerantsChain.eq).toHaveBeenCalledWith('is_premium', true);
    // r01 (premium) est tirée vers l'avant sur le premier rang premium.
    expect(res.body.map((row: any) => ({ id: row.id, premium: row.gerant_premium }))).toEqual([
      { id: 'r01', premium: true },
      { id: 'r00', premium: false },
      { id: 'r02', premium: false },
    ]);
  });

  it('200 : ne booste pas un gérant premium expiré', async () => {
    const rows = roomRows(3, 3).map((row, index) => ({ ...row, gerant_id: `g${index}` }));
    stubPublicRooms(fakeChain({ data: rows, error: null }));
    stubTables({
      gerants: fakeChain({
        data: [{ clerk_user_id: 'g1', is_premium: true, premium_expires_at: '2020-01-01T00:00:00.000Z' }],
        error: null,
      }),
    });

    const res = await request(app).get('/api/rooms?market=CI');

    expect(res.status).toBe(200);
    expect(res.body.map((row: any) => row.gerant_premium)).toEqual([false, false, false]);
    expect(res.body.map((row: any) => row.id)).toEqual(['r00', 'r01', 'r02']);
  });

  it('200 paginé : intercale les chambres premium (1 place sur 3)', async () => {
    const rows = roomRows(18, 12);
    const countChain = fakeChain({ count: 18, error: null, data: null });
    const dataChain = fakeChain({ data: rows, error: null });
    stubPublicRooms([countChain, dataChain]);
    stubTables({
      gerants: fakeChain({
        data: rows
          .slice(12)
          .map((row) => ({ clerk_user_id: row.gerant_id, is_premium: true, premium_expires_at: null })),
        error: null,
      }),
    });

    const res = await request(app).get('/api/rooms?market=CI&page=1&limit=6');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(18);
    // Fenêtre de 3 × 6 lignes, puis découpe de la page demandée.
    expect(dataChain.range).toHaveBeenCalledWith(0, 17);
    expect(res.body.items.map((row: any) => row.id)).toEqual(['r12', 'r00', 'r01', 'r13', 'r02', 'r03']);
    expect(res.body.items.filter((row: any) => row.gerant_premium)).toHaveLength(2);
  });

  it('200 paginé : sert la page 2 depuis la fenêtre intercalée', async () => {
    const rows = roomRows(18, 12);
    const countChain = fakeChain({ count: 18, error: null, data: null });
    const dataChain = fakeChain({ data: rows, error: null });
    stubPublicRooms([countChain, dataChain]);
    stubTables({
      gerants: fakeChain({
        data: rows
          .slice(12)
          .map((row) => ({ clerk_user_id: row.gerant_id, is_premium: true, premium_expires_at: null })),
        error: null,
      }),
    });

    const res = await request(app).get('/api/rooms?market=CI&page=2&limit=6');

    expect(res.status).toBe(200);
    // Fenêtre lue depuis le début (3 × 12 lignes), puis découpe [6, 12[.
    expect(dataChain.range).toHaveBeenCalledWith(0, 35);
    expect(res.body.items.map((row: any) => row.id)).toEqual(['r14', 'r04', 'r05', 'r15', 'r06', 'r07']);
    expect(res.body.items.filter((row: any) => row.gerant_premium)).toHaveLength(2);
    // La page ne contient aucune ligne déjà servie en page 1.
    const page1 = ['r12', 'r00', 'r01', 'r13', 'r02', 'r03'];
    expect(res.body.items.map((row: any) => row.id).some((id: string) => page1.includes(id))).toBe(false);
  });

  it('200 paginé : au-delà de la borne, repli sur l\'ordre organique', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const countChain = fakeChain({ count: 900, error: null, data: null });
    const rows = roomRows(2, 2);
    const dataChain = fakeChain({ data: rows, error: null });
    stubPublicQueue([countChain, dataChain]);

    const res = await request(app).get('/api/rooms?page=7&limit=100');

    expect(res.status).toBe(200);
    expect(dataChain.range).toHaveBeenCalledWith(600, 699);
    expect(res.body.items).toEqual(rows.map((row) => ({ ...row, gerant_premium: false })));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('GET /api/rooms/popular', () => {
  it('400 sur un marché inconnu', async () => {
    const res = await request(app).get('/api/rooms/popular?market=TG');
    expect(res.status).toBe(400);
  });

  it('200 : les chambres populaires d’abord, puis les plus réservées', async () => {
    publicRooms = fakeChain({
      data: [
        { id: 'r-pop', is_popular: true },
        { id: 'r-moins', is_popular: false },
        { id: 'r-plus', is_popular: false },
      ],
      error: null,
    });
    stubPublic(publicRooms);
    stubTables({
      reservations: fakeChain({
        data: [{ room_id: 'r-plus' }, { room_id: 'r-plus' }, { room_id: 'r-moins' }],
        error: null,
      }),
    });

    const res = await request(app).get('/api/rooms/popular?market=CI');
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual(['r-pop', 'r-plus', 'r-moins']);
  });
});

describe('GET /api/rooms/available', () => {
  it('400 sans dates', async () => {
    const res = await request(app).get('/api/rooms/available?market=CI');
    expect(res.status).toBe(400);
  });

  it('400 si la date de départ est antérieure à l’arrivée', async () => {
    const res = await request(app).get(
      '/api/rooms/available?arrivee=2026-05-10&depart=2026-05-01',
    );
    expect(res.status).toBe(400);
  });

  it('200 : exclut les chambres réservées et garde le match partiel de ville', async () => {
    publicRooms = fakeChain({
      data: [
        { id: 'r1', ville: 'Abidjan' },
        { id: 'r2', ville: 'Lomé-Centre' },
      ],
      error: null,
    });
    stubPublic(publicRooms);
    reservations = fakeChain({ data: [{ room_id: 'r1' }], error: null });
    stubTables({});

    const res = await request(app).get(
      '/api/rooms/available?market=CI&arrivee=2026-05-01&depart=2026-05-05&ville=Lom%C3%A9',
    );
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual(['r2']);
    expect(reservations.neq).toHaveBeenCalledWith('statut', 'annulee');
  });

  it('200 : classe les chambres disponibles selon le quota premium', async () => {
    const at = (minute: number) => `2026-01-01T00:${String(minute).padStart(2, '0')}:00.000Z`;
    publicRooms = fakeChain({
      data: [
        { id: 'r0', ville: 'Abidjan', gerant_id: 'gA', created_at: at(5) },
        { id: 'r1', ville: 'Abidjan', gerant_id: 'gA', created_at: at(4) },
        { id: 'r2', ville: 'Abidjan', gerant_id: 'gP1', created_at: at(3) },
        { id: 'r3', ville: 'Abidjan', gerant_id: 'gA', created_at: at(2) },
        { id: 'r4', ville: 'Abidjan', gerant_id: 'gA', created_at: at(1) },
        { id: 'r5', ville: 'Abidjan', gerant_id: 'gP2', created_at: at(0) },
      ],
      error: null,
    });
    stubPublic(publicRooms);
    stubTables({
      gerants: fakeChain({
        data: [
          { clerk_user_id: 'gP1', is_premium: true, premium_expires_at: null },
          { clerk_user_id: 'gP2', is_premium: true, premium_expires_at: null },
        ],
        error: null,
      }),
    });

    const res = await request(app).get(
      '/api/rooms/available?market=CI&arrivee=2026-05-01&depart=2026-05-05',
    );

    expect(res.status).toBe(200);
    // Deux boosts tirés vers l'avant (rangs 0 et 3), le reste garde l'ordre organique.
    expect(res.body.map((row: { id: string }) => row.id)).toEqual(['r2', 'r0', 'r1', 'r5', 'r3', 'r4']);
    expect(res.body.filter((row: { gerant_premium: boolean }) => row.gerant_premium)).toHaveLength(2);
    expect(res.body[5]).toMatchObject({ id: 'r4', gerant_premium: false });
  });
});

describe('GET /api/rooms/villes', () => {
  it('200 : déduplique les villes sur la forme normalisée', async () => {
    publicRooms = fakeChain({
      data: [{ ville: 'Bouaké' }, { ville: 'bouake' }, { ville: 'San-Pédro' }, { ville: '   ' }],
      error: null,
    });
    stubPublic(publicRooms);

    const res = await request(app).get('/api/rooms/villes?market=CI');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Bouaké', 'San-Pédro']);
  });
});

describe('GET /api/rooms/quartiers', () => {
  it('200 : liste distincte et triée, insensible à la casse', async () => {
    publicRooms = fakeChain({
      data: [{ quartier: 'Cocody' }, { quartier: 'cocody' }, { quartier: 'Plateau' }, { quartier: '  ' }],
      error: null,
    });
    stubPublic(publicRooms);

    const res = await request(app).get('/api/rooms/quartiers?market=CI');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Cocody', 'Plateau']);
    expect(publicRooms.eq).toHaveBeenCalledWith('market', 'CI');
  });

  it('400 sur un marché inconnu', async () => {
    const res = await request(app).get('/api/rooms/quartiers?market=TG');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/rooms/mine', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/rooms/mine');
    expect(res.status).toBe(401);
  });

  it('401 sur un jeton Clerk invalide', async () => {
    const res = await request(app).get('/api/rooms/mine').set('Authorization', 'Bearer bogus');
    expect(res.status).toBe(401);
  });

  it('200 : uniquement les chambres du gérant connecté', async () => {
    const mine = fakeChain({ data: [{ id: 'r1', gerant_id: 'user_1' }], error: null });
    stubTables({ rooms: mine });

    const res = await request(app)
      .get('/api/rooms/mine')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'r1', gerant_id: 'user_1' }]);
    expect(mine.eq).toHaveBeenCalledWith('gerant_id', 'user_1');
  });
});

describe('GET /api/rooms/:id', () => {
  it('400 sur un identifiant vide', async () => {
    const res = await request(app).get('/api/rooms/%20');
    expect(res.status).toBe(400);
  });

  it('404 si la chambre n’existe pas', async () => {
    const res = await request(app).get('/api/rooms/inconnue');
    expect(res.status).toBe(404);
  });

  it('200 : masque l’identité d’un gérant non vérifié', async () => {
    stubTables({
      rooms: fakeChain({ data: { id: 'r1', gerant_id: 'user_1' }, error: null }),
      gerants: fakeChain({ data: { nom: 'Koffi', is_verified: false }, error: null }),
    });

    const res = await request(app).get('/api/rooms/r1');
    expect(res.status).toBe(200);
    expect(res.body.gerant).toBeNull();
  });

  it('200 : expose le gérant vérifié', async () => {
    stubTables({
      rooms: fakeChain({ data: { id: 'r1', gerant_id: 'user_1' }, error: null }),
      gerants: fakeChain({ data: { nom: 'Aya', is_verified: true }, error: null }),
    });

    const res = await request(app).get('/api/rooms/r1');
    expect(res.status).toBe(200);
    expect(res.body.gerant).toEqual({ nom: 'Aya', is_verified: true });
  });
});

describe('POST /api/rooms', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/rooms').send(validRoom);
    expect(res.status).toBe(401);
  });

  it('400 sur un corps invalide même avec un token', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validRoom, price_unit: '/ semaine' });
    expect(res.status).toBe(400);
  });

  it('403 si le compte n’est pas gérant', async () => {
    stubTables({ gerants: fakeChain({ data: null, error: null }) });

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', clerkBearer('user_1'))
      .send(validRoom);
    expect(res.status).toBe(403);
  });

  it('403 si la chambre est créée hors du marché du gérant', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validRoom, market: 'BJ' });
    expect(res.status).toBe(403);
  });

  it('201 : insère la chambre avec le gerant_id du token', async () => {
    rooms = fakeChain({ data: { id: 'r1', ...validRoom, gerant_id: 'user_1' }, error: null });
    stubTables({});

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', clerkBearer('user_1'))
      .send(validRoom);

    expect(res.status).toBe(201);
    expect(rooms.insert).toHaveBeenCalledWith(
      expect.objectContaining({ gerant_id: 'user_1', title: 'Studio cocooning' }),
    );
  });
});

describe('PUT /api/rooms/:id', () => {
  it('401 sans token', async () => {
    const res = await request(app).put('/api/rooms/r1').send({ title: 'X' });
    expect(res.status).toBe(401);
  });

  it('400 sur un champ invalide', async () => {
    const res = await request(app)
      .put('/api/rooms/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('404 si la chambre n’existe pas', async () => {
    const res = await request(app)
      .put('/api/rooms/inconnue')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('403 si la chambre appartient à un autre gérant', async () => {
    stubTables({
      rooms: fakeChain({ data: { market: 'CI', gerant_id: 'autre_user' }, error: null }),
    });

    const res = await request(app)
      .put('/api/rooms/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  it('200 sur une mise à jour autorisée', async () => {
    const updated = fakeChain({ data: { id: 'r1', title: 'X' }, error: null });
    stubTables({
      rooms: [
        fakeChain({ data: { market: 'CI', gerant_id: 'user_1' }, error: null }),
        updated,
      ],
    });

    const res = await request(app)
      .put('/api/rooms/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'X' }),
    );
    expect(res.body).toEqual({ id: 'r1', title: 'X' });
  });
});

describe('DELETE /api/rooms/:id', () => {
  it('401 sans token', async () => {
    const res = await request(app).delete('/api/rooms/r1');
    expect(res.status).toBe(401);
  });

  it('403 si la chambre appartient à un autre gérant', async () => {
    stubTables({
      rooms: fakeChain({ data: { market: 'CI', gerant_id: 'autre_user' }, error: null }),
    });

    const res = await request(app)
      .delete('/api/rooms/r1')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('409 si des réservations actives existent', async () => {
    rooms = fakeChain({ data: { market: 'CI', gerant_id: 'user_1' }, error: null });
    stubTables({ reservations: fakeChain({ data: [{ id: 'resa-1' }], error: null }) });

    const res = await request(app)
      .delete('/api/rooms/r1')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(409);
    expect(rooms.delete).not.toHaveBeenCalled();
  });

  it('204 sur une suppression autorisée', async () => {
    const removed = fakeChain({ data: { id: 'r1' }, error: null });
    stubTables({
      rooms: [
        fakeChain({ data: { market: 'CI', gerant_id: 'user_1' }, error: null }),
        removed,
      ],
    });

    const res = await request(app)
      .delete('/api/rooms/r1')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(204);
    expect(removed.delete).toHaveBeenCalled();
    expect(removed.eq).toHaveBeenCalledWith('id', 'r1');
  });
});

describe('PATCH /api/rooms/:id/toggle', () => {
  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .patch('/api/rooms/%20/toggle')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
  });

  it('403 si la chambre appartient à un autre gérant', async () => {
    stubTables({
      rooms: fakeChain({
        data: { disponible: true, market: 'CI', gerant_id: 'autre_user' },
        error: null,
      }),
    });

    const res = await request(app)
      .patch('/api/rooms/r1/toggle')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('200 : inverse la disponibilité', async () => {
    const toggled = fakeChain({ data: { id: 'r1', disponible: false }, error: null });
    stubTables({
      rooms: [
        fakeChain({ data: { disponible: true, market: 'CI', gerant_id: 'user_1' }, error: null }),
        toggled,
      ],
    });

    const res = await request(app)
      .patch('/api/rooms/r1/toggle')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(toggled.update).toHaveBeenCalledWith({ disponible: false });
    expect(res.body.disponible).toBe(false);
  });
});
