import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import escapadesRouter from './escapades';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const validEscapade = {
  market: 'BJ',
  lieu: 'Ouidah',
  description: 'Plages et musée en famille.',
  images: ['/images/ouidah.jpg'],
};

let escapadesChain: FakeChain;
let adminChain: FakeChain;

const app = buildTestApp('/api/escapades', escapadesRouter);

function superadminChain(): FakeChain {
  return fakeChain({
    data: { id: 'admin-1', email: 'admin@test.ci', is_superadmin: true, permissions: [] },
    error: null,
  });
}

function mockAdminFrom(chain: FakeChain): void {
  vi.mocked(supabaseAdmin.from).mockImplementation(
    ((table: string) => (table === 'admins' ? superadminChain() : chain)) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  escapadesChain = fakeChain({ data: [], error: null });
  adminChain = fakeChain({ data: null, error: null });
  useSupabaseTables(supabasePublic.from, {
    escapades: escapadesChain,
  });
  mockAdminFrom(adminChain);
});

describe('GET /api/escapades', () => {
  it('400 sans market (cartes CI/BJ mélangées)', async () => {
    const res = await request(app).get('/api/escapades');
    expect(res.status).toBe(400);
  });

  it('400 sur un paramètre inconnu', async () => {
    const res = await request(app).get('/api/escapades?market=CI&tri=date');
    expect(res.status).toBe(400);
  });

  it('filtre par marché et trie par created_at puis id', async () => {
    const res = await request(app).get('/api/escapades?market=BJ');

    expect(res.status).toBe(200);
    expect(escapadesChain.eq).toHaveBeenCalledWith('market', 'BJ');
    expect(escapadesChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(escapadesChain.order).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('renvoie un tableau plat', async () => {
    escapadesChain = fakeChain({
      data: [
        { id: 'esc-bj-ouidah', market: 'BJ', lieu: 'Ouidah', description: 'Plages.', images: ['/images/ouidah.jpg'] },
        { id: 'esc-bj-ganvie', market: 'BJ', lieu: 'Ganvié', description: 'Lac.', images: ['/images/pexels-artbovich-7045712.jpg'] },
      ],
      error: null,
    });
    useSupabaseTables(supabasePublic.from, { escapades: escapadesChain });

    const res = await request(app).get('/api/escapades?market=BJ');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].lieu).toBe('Ouidah');
    expect(res.body[1].lieu).toBe('Ganvié');
  });

  it('renvoie [] quand le marché est vide (section masquée côté client)', async () => {
    const res = await request(app).get('/api/escapades?market=CD');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('500 quand la lecture échoue', async () => {
    escapadesChain = fakeChain({ data: null, error: { message: 'boom' } });
    useSupabaseTables(supabasePublic.from, { escapades: escapadesChain });

    const res = await request(app).get('/api/escapades?market=CI');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/escapades', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).post('/api/escapades').send(validEscapade);
    expect(res.status).toBe(401);
  });

  it('400 sur un corps invalide même avec un token', async () => {
    const res = await request(app)
      .post('/api/escapades')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validEscapade, market: 'XX' });
    expect(res.status).toBe(400);
  });

  it('403 si l’admin n’a pas la permission escapades', async () => {
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
      .post('/api/escapades')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validEscapade);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Permission refusée' });
    expect(adminChain.insert).not.toHaveBeenCalled();
  });

  it('201 avec id généré', async () => {
    adminChain = fakeChain({ data: { id: 'nouvel-id', ...validEscapade }, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .post('/api/escapades')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validEscapade);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('nouvel-id');
    expect(adminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), lieu: 'Ouidah', market: 'BJ' }),
    );
  });

  it('500 quand l’insertion échoue', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .post('/api/escapades')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validEscapade);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/escapades/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).put('/api/escapades/abc').send({ lieu: 'X' });
    expect(res.status).toBe(401);
  });

  it('400 sur un corps vide', async () => {
    const res = await request(app)
      .put('/api/escapades/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 quand l’escapade n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .put('/api/escapades/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ lieu: 'X' });

    expect(res.status).toBe(404);
  });

  it('200 sur une mise à jour valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc', lieu: 'Nouveau' }, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .put('/api/escapades/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ lieu: 'Nouveau' });

    expect(res.status).toBe(200);
    expect(adminChain.update).toHaveBeenCalledWith({ lieu: 'Nouveau' });
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });

  it('500 quand la mise à jour échoue', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .put('/api/escapades/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ lieu: 'X' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/escapades/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).delete('/api/escapades/abc');
    expect(res.status).toBe(401);
  });

  it('403 pour un admin non superadmin (permission manquante)', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(
      ((table: string) =>
        table === 'admins'
          ? fakeChain({
              data: { id: 'admin-2', is_superadmin: false, permissions: ['escapades'] },
              error: null,
            })
          : adminChain) as never,
    );

    const res = await request(app)
      .delete('/api/escapades/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(403);
  });

  it('404 quand l’escapade n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .delete('/api/escapades/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('204 sur une suppression valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc' }, error: null });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .delete('/api/escapades/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(204);
    expect(adminChain.delete).toHaveBeenCalled();
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });

  it('500 quand la suppression échoue', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    mockAdminFrom(adminChain);

    const res = await request(app)
      .delete('/api/escapades/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(500);
  });
});
