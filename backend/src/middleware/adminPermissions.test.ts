import request from 'supertest';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requirePermission, requireSuperadmin } from './adminPermissions';
import { requireAdminAuth } from './requireAdminAuth';
import { supabaseAdmin } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
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

const router = express.Router();
router.get('/section', requireAdminAuth, requirePermission('gerants'), (_req, res) => {
  res.json({ ok: true });
});
router.get('/super', requireAdminAuth, requireSuperadmin, (_req, res) => {
  res.json({ ok: true });
});
// Deux permissions sur la même requête : le cache req.adminPerms ne doit
// déclencher qu'une seule lecture de la table admins.
router.get(
  '/double',
  requireAdminAuth,
  requirePermission('gerants'),
  requirePermission('stats'),
  (_req, res) => {
    res.json({ ok: true });
  },
);

const app = buildTestApp('/api', router);

function auth() {
  return { Authorization: `Bearer ${adminToken()}` };
}

function stubAdminRow(row: unknown): void {
  useSupabaseTables(supabaseAdmin.from, {
    admins: fakeChain({ data: row, error: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

describe('requirePermission', () => {
  it('401 sans jeton admin', async () => {
    const res = await request(app).get('/api/section');
    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('403 si la ligne admin a disparu (compte supprimé entre-temps)', async () => {
    stubAdminRow(null);

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Permission refusée' });
  });

  it('403 pour un admin sans la permission', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: false, permissions: [] });

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Permission refusée' });
  });

  it('403 pour un admin qui porte une autre permission', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: false, permissions: ['stats'] });

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(403);
  });

  it('200 pour un admin portant la clé demandée', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: false, permissions: ['gerants'] });

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('200 pour un superadmin sans aucune permission explicite', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: true, permissions: [] });

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(200);
  });

  it('traite un jsonb permissions non-tableau comme une liste vide', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: false, permissions: 'gerants' });

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(403);
  });

  it('ignore les clés inconnues présentes dans le jsonb', async () => {
    stubAdminRow({
      id: 'admin-1',
      is_superadmin: false,
      permissions: ['inconnue', 42, 'gerants'],
    });

    const res = await request(app).get('/api/section').set(auth());
    expect(res.status).toBe(200);
  });

  it('ne relit la table admins qu’une fois par requête (cache)', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: false, permissions: ['gerants', 'stats'] });

    const res = await request(app).get('/api/double').set(auth());
    expect(res.status).toBe(200);
    expect(vi.mocked(supabaseAdmin.from).mock.calls.map((call) => call[0])).toEqual(['admins']);
  });
});

describe('requireSuperadmin', () => {
  it('403 pour un admin limité même richement permissionné', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: false, permissions: ['gerants', 'stats'] });

    const res = await request(app).get('/api/super').set(auth());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Permission refusée' });
  });

  it('200 pour le superadmin', async () => {
    stubAdminRow({ id: 'admin-1', is_superadmin: true, permissions: [] });

    const res = await request(app).get('/api/super').set(auth());
    expect(res.status).toBe(200);
  });

  it('403 si la ligne admin a disparu', async () => {
    stubAdminRow(null);

    const res = await request(app).get('/api/super').set(auth());
    expect(res.status).toBe(403);
  });
});
