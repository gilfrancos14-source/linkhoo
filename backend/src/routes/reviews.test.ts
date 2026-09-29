import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reviewsRouter from './reviews';
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

const app = buildTestApp('/api/reviews', reviewsRouter);

const VALID_BODY = {
  reservation_id: 'res-1',
  note_appartement: 5,
  note_gerant: 4,
  commentaire: 'Très bon séjour',
};

let rooms: FakeChain;
let reviews: FakeChain;
let clients: FakeChain;
let reservations: FakeChain;

type TableName = 'rooms' | 'reviews' | 'clients' | 'reservations';

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>> = {}): void {
  useSupabaseTables(supabaseAdmin.from, {
    rooms,
    reviews,
    clients,
    reservations,
    ...tables,
  });
}

const clientRow = {
  id: 'c1',
  email: 'jean@example.ci',
  nom: 'Kouassi',
  prenom: 'Jean',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  rooms = fakeChain({ data: null, error: null });
  reviews = fakeChain({ data: null, error: null });
  clients = fakeChain({ data: null, error: null });
  reservations = fakeChain({ data: null, error: null });
  stubTables();
});

describe('GET /api/reviews', () => {
  it('400 sans paramètre room_id', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Paramètre room_id invalide');
  });

  it('404 si la chambre nexiste pas', async () => {
    const res = await request(app).get('/api/reviews?room_id=room-x');
    expect(res.status).toBe(404);
  });

  it('200 : calcule les moyennes chambre et gérant', async () => {
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: 'user_1' }, error: null });
    const roomReviews = fakeChain({
      data: [
        { id: 'r1', note_appartement: 5, note_gerant: 5 },
        { id: 'r2', note_appartement: 3, note_gerant: 3 },
      ],
      error: null,
    });
    const gerantReviews = fakeChain({
      data: [{ note_gerant: 4 }, { note_gerant: 2 }],
      error: null,
    });
    stubTables({ reviews: [roomReviews, gerantReviews] });

    const res = await request(app).get('/api/reviews?room_id=room-1');

    expect(res.status).toBe(200);
    expect(res.body.room_avg).toBe(4);
    expect(res.body.room_count).toBe(2);
    expect(res.body.gerant_avg).toBe(3);
    expect(res.body.gerant_count).toBe(2);
  });

  it('200 : chambre sans gérant na pas d’agrégat gérant', async () => {
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: null }, error: null });
    reviews = fakeChain({ data: [], error: null });
    stubTables();

    const res = await request(app).get('/api/reviews?room_id=room-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reviews: [],
      room_avg: null,
      room_count: 0,
      gerant_avg: null,
      gerant_count: 0,
    });
    expect(reviews.select).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/reviews/mine', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/reviews/mine');
    expect(res.status).toBe(401);
  });

  it('200 : liste vide sans profil client', async () => {
    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('200 : renvoie les avis du client', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    reviews = fakeChain({
      data: [{ id: 'r1', room_id: 'room-1', note_appartement: 5 }],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(reviews.eq).toHaveBeenCalledWith('client_id', 'c1');
  });
});

describe('GET /api/reviews/featured', () => {
  it('200 : ne retient que les avis commentés', async () => {
    reviews = fakeChain({
      data: [{ id: 'r1', commentaire: 'Super', room: { title: 'Studio' } }],
      error: null,
    });
    stubTables();

    const res = await request(app).get('/api/reviews/featured');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(reviews.not).toHaveBeenCalledWith('commentaire', 'is', null);
    expect(reviews.limit).toHaveBeenCalledWith(3);
  });
});

describe('POST /api/reviews', () => {
  it('400 sur une note hors échelle', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...VALID_BODY, note_appartement: 9 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Données d'avis invalides");
  });

  it('404 sans profil client', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send(VALID_BODY);
    expect(res.status).toBe(404);
  });

  it('404 si la réservation nexiste pas', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send(VALID_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Réservation introuvable');
  });

  it('403 si la réservation appartient à un autre client', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    reservations = fakeChain({
      data: {
        id: 'res-1',
        client_email: 'autre@example.ci',
        room_id: 'room-1',
        statut: 'confirmee',
      },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send(VALID_BODY);
    expect(res.status).toBe(403);
  });

  it('400 si la réservation nest pas confirmée', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    reservations = fakeChain({
      data: {
        id: 'res-1',
        client_email: 'jean@example.ci',
        room_id: 'room-1',
        statut: 'en_attente',
      },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send(VALID_BODY);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('confirmées');
  });

  it('409 si un avis existe déjà pour la réservation', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    reservations = fakeChain({
      data: {
        id: 'res-1',
        client_email: 'jean@example.ci',
        room_id: 'room-1',
        statut: 'confirmee',
      },
      error: null,
    });
    reviews = fakeChain({ data: { id: 'r-old' }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send(VALID_BODY);
    expect(res.status).toBe(409);
  });

  it('201 : publie l’avis rattaché à la chambre et au gérant', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    reservations = fakeChain({
      data: {
        id: 'res-1',
        client_email: 'jean@example.ci',
        room_id: 'room-1',
        room_title: 'Studio',
        statut: 'confirmee',
      },
      error: null,
    });
    const existing = fakeChain({ data: null, error: null });
    rooms = fakeChain({ data: { gerant_id: 'user_1' }, error: null });
    const created = fakeChain({
      data: { id: 'r-new', room_id: 'room-1', note_appartement: 5 },
      error: null,
    });
    stubTables({ reviews: [existing, created] });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('r-new');
    expect(created.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'room-1',
        gerant_id: 'user_1',
        client_id: 'c1',
        client_name: 'Jean Kouassi',
        reservation_id: 'res-1',
        note_appartement: 5,
        note_gerant: 4,
        commentaire: 'Très bon séjour',
      }),
    );
  });

  it('201 : reconstitue un nom par défaut depuis lemail', async () => {
    clients = fakeChain({ data: { ...clientRow, nom: '', prenom: '' }, error: null });
    reservations = fakeChain({
      data: {
        id: 'res-1',
        client_email: 'jean@example.ci',
        room_id: 'room-1',
        statut: 'confirmee',
      },
      error: null,
    });
    const existing = fakeChain({ data: null, error: null });
    rooms = fakeChain({ data: { gerant_id: null }, error: null });
    const created = fakeChain({ data: { id: 'r-new' }, error: null });
    stubTables({ reviews: [existing, created] });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...VALID_BODY, commentaire: '' });

    expect(res.status).toBe(201);
    expect(created.insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: 'jean', gerant_id: null, commentaire: '' }),
    );
  });
});
