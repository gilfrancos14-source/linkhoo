import { Router, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireProfile } from './requireProfile';
import { supabaseAdmin } from '../config/supabase';
import { buildTestApp, fakeChain, useSupabaseTables } from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

/** Pose req.auth depuis l’en-tête `x-user-id` (absent → aucune auth). */
const fakeAuth: RequestHandler = (req, _res, next) => {
  const raw = req.headers['x-user-id'];
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (userId) req.auth = { userId };
  next();
};

const router = Router();
router.get('/client', fakeAuth, requireProfile('client'), (_req, res) => {
  res.json({ reached: true });
});
router.get('/gerant', fakeAuth, requireProfile('gerant'), (_req, res) => {
  res.json({ reached: true });
});

const app = buildTestApp('/api/require-profile', router);

let clients: ReturnType<typeof fakeChain>;
let gerants: ReturnType<typeof fakeChain>;

function stubTables(): void {
  useSupabaseTables(supabaseAdmin.from, { clients, gerants });
}

beforeEach(() => {
  vi.clearAllMocks();
  clients = fakeChain({ data: null, error: null });
  gerants = fakeChain({ data: null, error: null });
  stubTables();
});

describe('requireProfile — absence d’authentification', () => {
  it('401 sans req.auth (rôle client) et n’interroge pas Supabase', async () => {
    const res = await request(app).get('/api/require-profile/client');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Non autorisé' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('401 sans req.auth (rôle gérant)', async () => {
    const res = await request(app).get('/api/require-profile/gerant');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Non autorisé');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('n’appelle pas le handler suivant quand l’auth manque', async () => {
    const res = await request(app).get('/api/require-profile/client');
    expect(res.status).toBe(401);
    expect(res.body.reached).toBeUndefined();
  });
});

describe('requireProfile — rôle client', () => {
  it('200 et appelle next() si la ligne clients existe', async () => {
    clients = fakeChain({ data: { id: 'c1' }, error: null });
    stubTables();
    const res = await request(app)
      .get('/api/require-profile/client')
      .set('x-user-id', 'user_1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reached: true });
    expect(supabaseAdmin.from).toHaveBeenCalledWith('clients');
  });

  it('interroge clients sur clerk_user_id', async () => {
    clients = fakeChain({ data: { id: 'c1' }, error: null });
    stubTables();
    await request(app)
      .get('/api/require-profile/client')
      .set('x-user-id', 'user_1');
    expect(clients.select).toHaveBeenCalledWith('id');
    expect(clients.eq).toHaveBeenCalledWith('clerk_user_id', 'user_1');
    expect(clients.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('403 avec le détail role quand le compte client n’existe pas', async () => {
    const res = await request(app)
      .get('/api/require-profile/client')
      .set('x-user-id', 'user_1');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Accès réservé aux comptes client', role: 'client' });
    expect(res.body.reached).toBeUndefined();
  });

  it('500 quand la requête Supabase échoue (erreur remontée)', async () => {
    clients = fakeChain({ data: null, error: { message: 'timeout' } });
    stubTables();
    const res = await request(app)
      .get('/api/require-profile/client')
      .set('x-user-id', 'user_1');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur interne du serveur');
  });
});

describe('requireProfile — rôle gérant', () => {
  it('200 et appelle next() si la ligne gerants existe', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables();
    const res = await request(app)
      .get('/api/require-profile/gerant')
      .set('x-user-id', 'user_2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reached: true });
    expect(supabaseAdmin.from).toHaveBeenCalledWith('gerants');
  });

  it('403 avec le détail role pour un compte gérant absent', async () => {
    const res = await request(app)
      .get('/api/require-profile/gerant')
      .set('x-user-id', 'user_2');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Accès réservé aux comptes gérant', role: 'gerant' });
  });

  it('cible la bonne table selon le rôle demandé', async () => {
    clients = fakeChain({ data: { id: 'c1' }, error: null });
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables();
    await request(app)
      .get('/api/require-profile/client')
      .set('x-user-id', 'user_1');
    await request(app)
      .get('/api/require-profile/gerant')
      .set('x-user-id', 'user_2');
    const tables = vi.mocked(supabaseAdmin.from).mock.calls.map((call) => call[0]);
    expect(tables).toEqual(['clients', 'gerants']);
  });
});
