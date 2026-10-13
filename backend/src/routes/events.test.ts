import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import eventsRouter from './events';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const validEvent = {
  market: 'CI',
  city: 'Abidjan',
  title: 'Salon immobilier',
  description: '',
  event_date: '2099-10-12',
  img: 'https://cdn.example.com/e.webp',
  alt: 'Stand',
};

let publicChain: FakeChain;
let adminChain: FakeChain;

const app = buildTestApp('/api/events', eventsRouter);

function superadminChain(): FakeChain {
  return fakeChain({
    data: { id: 'admin-1', email: 'admin@test.ci', is_superadmin: true, permissions: [] },
    error: null,
  });
}

// requirePermission lit la table admins à chaque requête authentifiée :
// on la route vers un superadmin, le reste vers la chaîne du test.
function mockAdminFrom(chain: FakeChain): void {
  vi.mocked(supabaseAdmin.from).mockImplementation(
    ((table: string) => (table === 'admins' ? superadminChain() : chain)) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  publicChain = fakeChain({ data: [], error: null });
  adminChain = fakeChain({ data: null, error: null });
  vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);
  mockAdminFrom(adminChain);
});

describe('GET /api/events', () => {
  it('400 sans market (villes CI/BJ mélangées)', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(400);
  });

  it('filtre les événements passés de plus de 7 jours pour le public', async () => {
    const res = await request(app).get('/api/events?market=CI');
    expect(res.status).toBe(200);

    const expectedCutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    expect(publicChain.gte).toHaveBeenCalledWith('event_date', expectedCutoff);
  });

  it('401 sur include_past=1 sans token admin', async () => {
    const res = await request(app).get('/api/events?market=CI&include_past=1');
    expect(res.status).toBe(401);
    expect(publicChain.gte).not.toHaveBeenCalled();
  });

  it('200 sur include_past=1 avec un token admin valide, sans filtre de date', async () => {
    const res = await request(app)
      .get('/api/events?market=CI&include_past=1')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(publicChain.gte).not.toHaveBeenCalled();
  });

  it('200 sans market avec include_past=1 : liste TOUS les marchés (back-office)', async () => {
    const res = await request(app)
      .get('/api/events?include_past=1')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(publicChain.eq).not.toHaveBeenCalled();
    expect(publicChain.gte).not.toHaveBeenCalled();
  });

  it('401 sur include_past=1 sans market ni token admin', async () => {
    const res = await request(app).get('/api/events?include_past=1');
    expect(res.status).toBe(401);
    expect(publicChain.eq).not.toHaveBeenCalled();
  });

  it('400 sur un paramètre inconnu', async () => {
    const res = await request(app).get('/api/events?market=CI&tri=date');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/events', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).post('/api/events').send(validEvent);
    expect(res.status).toBe(401);
  });

  it('400 sur un corps invalide même avec un token', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validEvent, market: 'XX' });
    expect(res.status).toBe(400);
  });

  it('403 si l’admin connecté n’a pas la permission evenements', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(
      ((table: string) =>
        table === 'admins'
          ? fakeChain({
              data: { id: 'admin-2', is_superadmin: false, permissions: ['gerants'] },
              error: null,
            })
          : adminChain) as never,
    );

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validEvent);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Permission refusée' });
    expect(adminChain.insert).not.toHaveBeenCalled();
  });

  it('201 et insertion avec un id généré', async () => {
    adminChain = fakeChain({ data: { id: 'nouvel-id', ...validEvent }, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validEvent);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('nouvel-id');
    expect(adminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), title: 'Salon immobilier' }),
    );
  });
});

describe('PUT /api/events/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).put('/api/events/abc').send({ title: 'X' });
    expect(res.status).toBe(401);
  });

  it('400 sur un corps vide (mise à jour sans effet)', async () => {
    const res = await request(app)
      .put('/api/events/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 quand l’événement n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .put('/api/events/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });

  it('200 sur une mise à jour valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc', title: 'X' }, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .put('/api/events/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'X' });

    expect(res.status).toBe(200);
    expect(adminChain.update).toHaveBeenCalledWith({ title: 'X' });
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });
});

describe('DELETE /api/events/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).delete('/api/events/abc');
    expect(res.status).toBe(401);
  });

  it('404 quand l’événement n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .delete('/api/events/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('204 sur une suppression valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc' }, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .delete('/api/events/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(204);
    expect(adminChain.delete).toHaveBeenCalled();
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });
});
