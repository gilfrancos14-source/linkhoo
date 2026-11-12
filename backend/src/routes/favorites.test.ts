import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import favoritesRouter from './favorites';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { supabaseAdmin } from '../config/supabase';
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

const app = buildTestApp('/api/favorites', favoritesRouter, {
  middlewares: [requireClerkAuth],
});

let clients: FakeChain;
let favorites: FakeChain;
let rooms: FakeChain;

function stubTables(): void {
  useSupabaseTables(supabaseAdmin.from, {
    clients,
    client_favorites: favorites,
    rooms,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  clients = fakeChain({ data: { id: 'c1' }, error: null });
  favorites = fakeChain({ data: null, error: null });
  rooms = fakeChain({ data: null, error: null });
  stubTables();
});

describe('GET /api/favorites', () => {
  it('401 sans jeton', async () => {
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(401);
  });

  it('403 quand le profil client est absent', async () => {
    clients = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(403);
  });

  it('200 : renvoie les chambres dans l’ordre des favoris', async () => {
    favorites = fakeChain({
      data: [
        { room_id: 'room-b', created_at: '2026-01-02T10:00:00.000Z' },
        { room_id: 'room-a', created_at: '2026-01-01T10:00:00.000Z' },
      ],
      error: null,
    });
    rooms = fakeChain({
      data: [
        { id: 'room-a', title: 'Studio A' },
        { id: 'room-b', title: 'Studio B' },
      ],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.map((room: { id: string }) => room.id)).toEqual(['room-b', 'room-a']);
    expect(res.body[0].favorited_at).toBe('2026-01-02T10:00:00.000Z');
    expect(favorites.eq).toHaveBeenCalledWith('client_id', 'c1');
    expect(favorites.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('200 : ignore un favori dont la chambre a été supprimée', async () => {
    favorites = fakeChain({
      data: [
        { room_id: 'room-a', created_at: '2026-01-01T10:00:00.000Z' },
        { room_id: 'room-deleted', created_at: '2025-12-01T10:00:00.000Z' },
      ],
      error: null,
    });
    rooms = fakeChain({ data: [{ id: 'room-a', title: 'Studio A' }], error: null });
    stubTables();

    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('room-a');
  });
});

describe('POST /api/favorites/:id', () => {
  it('403 sans profil client', async () => {
    clients = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/favorites/room-1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(403);
  });

  it('404 quand la chambre n’existe pas', async () => {
    rooms = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/favorites/room-x')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Chambre introuvable');
  });

  it('201 : ajoute la chambre aux favoris et la renvoie', async () => {
    rooms = fakeChain({
      data: { id: 'room-1', title: 'Suite vue mer', prix: 45000 },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/favorites/room-1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      room_id: 'room-1',
      favorite: true,
      room: { id: 'room-1', title: 'Suite vue mer' },
    });
    expect(typeof res.body.room.favorited_at).toBe('string');
    expect(favorites.upsert).toHaveBeenCalledWith(
      { client_id: 'c1', room_id: 'room-1' },
      { onConflict: 'client_id,room_id', ignoreDuplicates: true },
    );
  });
});

describe('DELETE /api/favorites/:id', () => {
  it('200 : retire le favori (idempotent)', async () => {
    const res = await request(app)
      .delete('/api/favorites/room-1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ room_id: 'room-1', favorite: false });
    expect(favorites.delete).toHaveBeenCalled();
    expect(favorites.eq).toHaveBeenCalledWith('client_id', 'c1');
    expect(favorites.eq).toHaveBeenCalledWith('room_id', 'room-1');
  });
});
