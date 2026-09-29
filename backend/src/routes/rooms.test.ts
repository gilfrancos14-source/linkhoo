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

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>>): void {
  useSupabaseTables(supabaseAdmin.from, {
    rooms,
    gerants,
    reservations,
    ...tables,
  });
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
    expect(res.body).toEqual([{ id: 'r1' }]);
    expect(publicRooms.eq).toHaveBeenCalledWith('market', 'CI');
    expect(publicRooms.range).toHaveBeenCalledWith(0, 999);
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
