import { Router } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAdminOrGerant, requireClerkAuth, requireClerkOrAdminAuth } from './clerkAuth';
import { supabaseAdmin } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

const router = Router();
router.get('/whoami', (req, res) => {
  res.json({ auth: req.auth ?? null, admin: req.admin ?? null });
});

const clerkApp = buildTestApp('/api/clerk', router, { middlewares: [requireClerkAuth] });
const orAdminApp = buildTestApp('/api/or-admin', router, {
  middlewares: [requireClerkOrAdminAuth],
});
const roleApp = buildTestApp('/api/role', router, {
  middlewares: [requireClerkOrAdminAuth, requireAdminOrGerant],
});
const gerantOnlyApp = buildTestApp('/api/gerant-only', router, {
  middlewares: [requireAdminOrGerant],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  useSupabaseTables(supabaseAdmin.from, { gerants: fakeChain({ data: null, error: null }) });
});

describe('requireClerkAuth', () => {
  it('401 sans en-tête Authorization', async () => {
    const res = await request(clerkApp).get('/api/clerk/whoami');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification manquant" });
  });

  it('401 pour un schéma d’authentification autre que Bearer', async () => {
    const res = await request(clerkApp)
      .get('/api/clerk/whoami')
      .set('Authorization', 'Basic dXNlcjpwdw==');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 quand verifyToken rejette le jeton', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('Token Clerk invalide'));
    const res = await request(clerkApp)
      .get('/api/clerk/whoami')
      .set('Authorization', 'Bearer jeton-falsifie');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification invalide" });
  });

  it('401 : n’exécute pas le handler suivant quand le jeton échoue', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('invalide'));
    const res = await request(clerkApp)
      .get('/api/clerk/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(401);
    expect(res.body.auth).toBeUndefined();
  });

  it('200 : pose req.auth (userId, sessionId, sessionClaims) et appelle next()', async () => {
    const res = await request(clerkApp)
      .get('/api/clerk/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body.auth.userId).toBe('user_1');
    expect(res.body.auth.sessionId).toBe('session_test');
    expect(res.body.auth.sessionClaims.sub).toBe('user_1');
    expect(res.body.admin).toBeNull();
  });

  it('appelle verifyToken avec le jeton nu, clockSkewInMs=60000 et la clé secrète', async () => {
    await request(clerkApp)
      .get('/api/clerk/whoami')
      .set('Authorization', clerkBearer('user_42'));
    expect(verifyToken).toHaveBeenCalledTimes(1);
    expect(verifyToken).toHaveBeenCalledWith(
      'clerk_user_42',
      expect.objectContaining({ clockSkewInMs: 60_000 }),
    );
  });

  it('gère un userId Clerk avec caractères spéciaux', async () => {
    const res = await request(clerkApp)
      .get('/api/clerk/whoami')
      .set('Authorization', clerkBearer('user_&?#1'));
    expect(res.status).toBe(200);
    expect(res.body.auth.userId).toBe('user_&?#1');
  });
});

describe('requireClerkOrAdminAuth', () => {
  it('401 sans en-tête Authorization', async () => {
    const res = await request(orAdminApp).get('/api/or-admin/whoami');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('200 via Clerk : pose req.auth, pas req.admin', async () => {
    const res = await request(orAdminApp)
      .get('/api/or-admin/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body.auth.userId).toBe('user_1');
    expect(res.body.admin).toBeNull();
  });

  it('200 via JWT admin quand Clerk refuse le jeton', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('pas un jeton Clerk'));
    const res = await request(orAdminApp)
      .get('/api/or-admin/whoami')
      .set('Authorization', `Bearer ${adminToken({ adminId: 'a7', email: 'a7@test.ci' })}`);
    expect(res.status).toBe(200);
    expect(res.body.admin).toMatchObject({ adminId: 'a7', email: 'a7@test.ci' });
    expect(res.body.auth).toBeNull();
  });

  it('401 pour un JWT admin signé du bon secret mais sans claims admin', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('pas un jeton Clerk'));
    const sansClaims = jwt.sign({ sub: 'user_1', sid: 'sess' }, 'secret-de-test');
    const res = await request(orAdminApp)
      .get('/api/or-admin/whoami')
      .set('Authorization', `Bearer ${sansClaims}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
    expect(res.body.admin).toBeUndefined();
    expect(res.body.auth).toBeUndefined();
  });

  it('401 quand ni Clerk ni l’admin ne reconnaissent le jeton', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('invalide'));
    const res = await request(orAdminApp)
      .get('/api/or-admin/whoami')
      .set('Authorization', 'Bearer nimporte-quoi');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  it('appelle verifyToken avant de retomber sur le JWT admin', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('invalide'));
    await request(orAdminApp)
      .get('/api/or-admin/whoami')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(verifyToken).toHaveBeenCalledTimes(1);
  });
});

describe('requireAdminOrGerant', () => {
  it('401 sans aucun jeton posé (ni admin, ni auth)', async () => {
    const res = await request(gerantOnlyApp).get('/api/gerant-only/whoami');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Non autorisé');
  });

  it('200 pour l’admin JWT sans requête Supabase', async () => {
    const res = await request(roleApp)
      .get('/api/role/whoami')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.adminId).toBe('admin-1');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('200 pour un compte gérant existant', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      gerants: fakeChain({ data: { id: 'g1' }, error: null }),
    });
    const res = await request(roleApp)
      .get('/api/role/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body.auth.userId).toBe('user_1');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('gerants');
  });

  it('interroge gerants sur clerk_user_id', async () => {
    const gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
    await request(roleApp)
      .get('/api/role/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(gerants.eq).toHaveBeenCalledWith('clerk_user_id', 'user_1');
    expect(gerants.select).toHaveBeenCalledWith('id');
  });

  it('403 pour un compte non gérant (client connecté)', async () => {
    const res = await request(roleApp)
      .get('/api/role/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Accès réservé aux comptes gérant');
  });

  it('500 quand la requête Supabase échoue (erreur remontée à errorHandler)', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      gerants: fakeChain({ data: null, error: { message: 'relation manquante' } }),
    });
    const res = await request(roleApp)
      .get('/api/role/whoami')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur interne du serveur');
  });
});
