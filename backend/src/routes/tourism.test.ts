import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import tourismRouter from './tourism';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';
import { UPCOMING_WINDOW_DAYS } from '../utils/tourism';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const validDestination = {
  market: 'BJ',
  city: 'Ouidah',
  title: 'Route des esclaves',
  description: 'Balade historique sur la côte.',
  img: 'https://cdn.example.com/ouidah.webp',
  alt: 'Route des esclaves',
  featured: false,
};

const today = new Date().toISOString().slice(0, 10);
const inWindow = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const outWindow = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);

let eventsChain: FakeChain;
let destinationsChain: FakeChain;
let adminChain: FakeChain;

const app = buildTestApp('/api/tourism', tourismRouter);

beforeEach(() => {
  vi.clearAllMocks();
  eventsChain = fakeChain({ data: [], error: null });
  destinationsChain = fakeChain({ data: [], error: null });
  adminChain = fakeChain({ data: null, error: null });
  useSupabaseTables(supabasePublic.from, {
    events: eventsChain,
    tourism_destinations: destinationsChain,
  });
  vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);
});

describe('GET /api/tourism', () => {
  it('400 sans market (destinations CI/BJ mélangées)', async () => {
    const res = await request(app).get('/api/tourism');
    expect(res.status).toBe(400);
  });

  it('400 sur un paramètre inconnu', async () => {
    const res = await request(app).get('/api/tourism?market=CI&tri=date');
    expect(res.status).toBe(400);
  });

  it('limite la recherche d’événements à la fenêtre de 30 jours', async () => {
    const res = await request(app).get('/api/tourism?market=BJ');
    expect(res.status).toBe(200);

    const to = new Date(Date.now() + UPCOMING_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    expect(eventsChain.gte).toHaveBeenCalledWith('event_date', today);
    expect(eventsChain.lte).toHaveBeenCalledWith('event_date', to);
    expect(eventsChain.eq).toHaveBeenCalledWith('market', 'BJ');
    expect(destinationsChain.eq).toHaveBeenCalledWith('market', 'BJ');
  });

  it('partitionne : éligible + featured en big, le reste en small', async () => {
    eventsChain = fakeChain({
      data: [
        { city: 'Ouidah', event_date: inWindow },
        { city: 'Abidjan', event_date: outWindow },
      ],
      error: null,
    });
    destinationsChain = fakeChain({
      data: [
        { id: 'far', city: 'Abidjan', featured: false, created_at: '2026-09-01T00:00:00Z' },
        { id: 'near', city: 'Ouidah', featured: false, created_at: '2026-09-02T00:00:00Z' },
        { id: 'boosted', city: 'Korhogo', featured: true, created_at: '2026-09-03T00:00:00Z' },
      ],
      error: null,
    });
    useSupabaseTables(supabasePublic.from, {
      events: eventsChain,
      tourism_destinations: destinationsChain,
    });

    const res = await request(app).get('/api/tourism?market=BJ');

    expect(res.status).toBe(200);
    expect(res.body.big.map((d: { id: string }) => d.id)).toEqual(['boosted', 'near']);
    expect(res.body.small.map((d: { id: string }) => d.id)).toEqual(['far']);
  });

  it('500 quand la lecture des événements du marché échoue', async () => {
    eventsChain = fakeChain({ data: null, error: { message: 'boom' } });
    useSupabaseTables(supabasePublic.from, {
      events: eventsChain,
      tourism_destinations: destinationsChain,
    });

    const res = await request(app).get('/api/tourism?market=CI');

    expect(res.status).toBe(500);
  });

  it('renvoie 0 grosse carte quand rien n’est éligible (jamais de carte fake)', async () => {
    destinationsChain = fakeChain({
      data: [
        { id: 'a', city: 'Korhogo', featured: false },
        { id: 'b', city: 'Bouaké', featured: false },
      ],
      error: null,
    });
    useSupabaseTables(supabasePublic.from, {
      events: eventsChain,
      tourism_destinations: destinationsChain,
    });

    const res = await request(app).get('/api/tourism?market=CI');

    expect(res.status).toBe(200);
    expect(res.body.big).toEqual([]);
    expect(res.body.small.map((d: { id: string }) => d.id)).toEqual(['a', 'b']);
  });
});

describe('POST /api/tourism', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).post('/api/tourism').send(validDestination);
    expect(res.status).toBe(401);
  });

  it('400 sur un corps invalide même avec un token', async () => {
    const res = await request(app)
      .post('/api/tourism')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validDestination, market: 'XX' });
    expect(res.status).toBe(400);
  });

  it('201, id généré et featured par défaut à false', async () => {
    adminChain = fakeChain({ data: { id: 'nouvel-id', ...validDestination }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const { featured: _ignored, ...body } = validDestination;
    const res = await request(app)
      .post('/api/tourism')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('nouvel-id');
    expect(adminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), featured: false, city: 'Ouidah' }),
    );
  });

  it('500 quand l’insertion échoue', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .post('/api/tourism')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validDestination);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/tourism/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).put('/api/tourism/abc').send({ title: 'X' });
    expect(res.status).toBe(401);
  });

  it('400 sur un corps vide (mise à jour sans effet)', async () => {
    const res = await request(app)
      .put('/api/tourism/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 quand la destination n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/tourism/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });

  it('200 sur une mise à jour valide (bypass featured)', async () => {
    adminChain = fakeChain({ data: { id: 'abc', featured: true }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/tourism/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ featured: true });

    expect(res.status).toBe(200);
    expect(adminChain.update).toHaveBeenCalledWith({ featured: true });
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });

  it('500 quand la mise à jour échoue', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/tourism/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ featured: true });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/tourism/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).delete('/api/tourism/abc');
    expect(res.status).toBe(401);
  });

  it('404 quand la destination n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .delete('/api/tourism/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .delete('/api/tourism/%20')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
    expect(adminChain.delete).not.toHaveBeenCalled();
  });

  it('204 sur une suppression valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .delete('/api/tourism/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(204);
    expect(adminChain.delete).toHaveBeenCalled();
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });

  it('500 quand la suppression échoue', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .delete('/api/tourism/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(500);
  });
});
