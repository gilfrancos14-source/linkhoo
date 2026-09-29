import { Router, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireGerantMarket } from './requireGerantMarket';
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

router.post('/verified', fakeAuth, async (req, res, next) => {
  try {
    const info = await requireGerantMarket(req, res);
    if (!info) return;
    res.json(info);
  } catch (err) {
    next(err);
  }
});

router.post('/any', fakeAuth, async (req, res, next) => {
  try {
    const info = await requireGerantMarket(req, res, { requireVerified: false });
    if (!info) return;
    res.json(info);
  } catch (err) {
    next(err);
  }
});

const app = buildTestApp('/api/gerant-market', router);

let gerants: ReturnType<typeof fakeChain>;

beforeEach(() => {
  vi.clearAllMocks();
  gerants = fakeChain({ data: null, error: null });
  useSupabaseTables(supabaseAdmin.from, { gerants });
});

function asGerant(user: string): request.Test {
  return request(app).post('/api/gerant-market/verified').set('x-user-id', user);
}

describe('requireGerantMarket — absence d’authentification', () => {
  it('401 sans req.auth et n’interroge pas Supabase', async () => {
    const res = await request(app).post('/api/gerant-market/verified');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Non autorisé' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('401 sans req.auth même avec requireVerified: false', async () => {
    const res = await request(app).post('/api/gerant-market/any');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Non autorisé');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});

describe('requireGerantMarket — refus (403)', () => {
  it('403 si le compte n’est pas gérant (aucune ligne)', async () => {
    const res = await asGerant('user_inconnu');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'Seuls les gérants vérifiés peuvent effectuer cette action',
    });
  });

  it('403 si la requête Supabase échoue', async () => {
    gerants = fakeChain({ data: null, error: { message: 'délai dépassé' } });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await asGerant('user_1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Seuls les gérants vérifiés peuvent effectuer cette action');
  });

  it('403 si le gérant n’est pas vérifié (comportement par défaut)', async () => {
    gerants = fakeChain({ data: { market: 'CI', is_verified: false }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await asGerant('user_1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Seuls les gérants vérifiés peuvent effectuer cette action');
  });

  it('403 si is_verified est absent (falsy)', async () => {
    gerants = fakeChain({ data: { market: 'CI' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await asGerant('user_1');
    expect(res.status).toBe(403);
  });
});

describe('requireGerantMarket — succès', () => {
  it('200 : renvoie market et userId pour un gérant vérifié', async () => {
    gerants = fakeChain({ data: { market: 'CI', is_verified: true }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await asGerant('user_1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ market: 'CI', userId: 'user_1' });
  });

  it('200 : renvoie le marché BJ', async () => {
    gerants = fakeChain({ data: { market: 'BJ', is_verified: true }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await asGerant('user_2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ market: 'BJ', userId: 'user_2' });
  });

  it('200 avec requireVerified: false pour un gérant non vérifié', async () => {
    gerants = fakeChain({ data: { market: 'CI', is_verified: false }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await request(app)
      .post('/api/gerant-market/any')
      .set('x-user-id', 'user_1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ market: 'CI', userId: 'user_1' });
  });

  it('requête la table gerants sur clerk_user_id avec les colonnes attendues', async () => {
    gerants = fakeChain({ data: { market: 'CI', is_verified: true }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    await asGerant('user_1');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('gerants');
    expect(gerants.select).toHaveBeenCalledWith('market, is_verified');
    expect(gerants.eq).toHaveBeenCalledWith('clerk_user_id', 'user_1');
    expect(gerants.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('200 : distingue un userId contenant des caractères spéciaux', async () => {
    gerants = fakeChain({ data: { market: 'CI', is_verified: true }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    const res = await asGerant('user_x/y');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user_x/y');
  });
});
