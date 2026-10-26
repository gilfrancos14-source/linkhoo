import request from 'supertest';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import adminRouter from './admin';
import { supabaseAdmin } from '../config/supabase';
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

const app = buildTestApp('/api/admin', adminRouter);

const SUPER_AUTH = { Authorization: `Bearer ${adminToken()}` };
const LIMIT_AUTH = {
  Authorization: `Bearer ${adminToken({ adminId: 'admin-2', email: 'limite@test.ci' })}`,
};

const SUPER_ROW = { id: 'admin-1', email: 'admin@test.ci', is_superadmin: true, permissions: [] };

const PUBLIC_COLUMNS =
  'id, email, nom, prenom, is_superadmin, permissions, created_at, updated_at';

function stubSuperadmin(): void {
  useSupabaseTables(supabaseAdmin.from, { admins: fakeChain({ data: SUPER_ROW, error: null }) });
}

function superLookup(): FakeChain {
  return fakeChain({ data: SUPER_ROW, error: null });
}

/**
 * La requête passe d'abord par requireSuperadmin (lookup is_superadmin) :
 * on empile cette lecture avant les chaînes propres au scénario du test.
 */
function stubAdmins(...chains: FakeChain[]): void {
  useSupabaseTables(supabaseAdmin.from, { admins: [superLookup(), ...chains] });
}

function stubLimitedAdmin(permissions: string[] = []): void {
  useSupabaseTables(supabaseAdmin.from, {
    admins: fakeChain({
      data: { id: 'admin-2', email: 'limite@test.ci', is_superadmin: false, permissions },
      error: null,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  stubSuperadmin();
});

describe('GET /api/admin/admins/permissions', () => {
  it('200 : renvoie le catalogue des 9 permissions (accessible à tout admin connecté)', async () => {
    stubLimitedAdmin([]);

    const res = await request(app).get('/api/admin/admins/permissions').set(LIMIT_AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
    expect(res.body.map((p: { key: string }) => p.key)).toEqual([
      'gerants',
      'reservations',
      'bannieres',
      'evenements',
      'destinations',
      'escapades',
      'promotions',
      'stats',
    ]);
    expect(res.body[0]).toMatchObject({ label: expect.any(String), description: expect.any(String) });
  });
});

describe('GET /api/admin/admins', () => {
  it('403 pour un admin non-superadmin', async () => {
    stubLimitedAdmin(['stats']);

    const res = await request(app).get('/api/admin/admins').set(LIMIT_AUTH);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Permission refusée' });
  });

  it('200 : liste les comptes sans jamais selecter password_hash', async () => {
    const rows = [
      {
        id: 'admin-1',
        email: 'admin@test.ci',
        nom: 'Admin',
        prenom: 'Test',
        is_superadmin: true,
        permissions: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];
    const list = fakeChain({ data: rows, error: null });
    stubAdmins(list);

    const res = await request(app).get('/api/admin/admins').set(SUPER_AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(list.select).toHaveBeenCalledWith(PUBLIC_COLUMNS);
    expect(list.select).not.toHaveBeenCalledWith(expect.stringContaining('password_hash'));
    expect(list.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

describe('POST /api/admin/admins', () => {
  it('403 pour un admin non-superadmin', async () => {
    stubLimitedAdmin([]);

    const res = await request(app)
      .post('/api/admin/admins')
      .set(LIMIT_AUTH)
      .send({ email: 'x@test.ci', password: 'Secret123', nom: 'X', prenom: 'Y', permissions: [] });

    expect(res.status).toBe(403);
  });

  it('400 si le mot de passe est trop court', async () => {
    const res = await request(app)
      .post('/api/admin/admins')
      .set(SUPER_AUTH)
      .send({ email: 'x@test.ci', password: 'abc', nom: 'X', prenom: 'Y', permissions: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Données invalides');
  });

  it('400 sur une clé de permission inconnue', async () => {
    const res = await request(app)
      .post('/api/admin/admins')
      .set(SUPER_AUTH)
      .send({ email: 'x@test.ci', password: 'Secret123', nom: 'X', prenom: 'Y', permissions: ['magique'] });

    expect(res.status).toBe(400);
  });

  it('409 si l’email est déjà pris', async () => {
    const check = fakeChain({ data: { id: 'existant' }, error: null });
    stubAdmins(check);

    const res = await request(app)
      .post('/api/admin/admins')
      .set(SUPER_AUTH)
      .send({ email: 'deja@test.ci', password: 'Secret123', nom: 'X', prenom: 'Y', permissions: [] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Un compte existe déjà avec cet email' });
  });

  it('201 : crée le compte avec un hash bcrypt et is_superadmin=false', async () => {
    const check = fakeChain({ data: null, error: null });
    const created = fakeChain({
      data: {
        id: 'nouveau-1',
        email: 'nouveau@test.ci',
        nom: 'Nouveau',
        prenom: 'Compte',
        is_superadmin: false,
        permissions: ['gerants'],
        created_at: '2026-10-10T00:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
      },
      error: null,
    });
    stubAdmins(check, created);

    const res = await request(app)
      .post('/api/admin/admins')
      .set(SUPER_AUTH)
      .send({
        email: 'nouveau@test.ci',
        password: 'Secret123',
        nom: 'Nouveau',
        prenom: 'Compte',
        permissions: ['gerants'],
      });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).toMatchObject({ id: 'nouveau-1', is_superadmin: false, permissions: ['gerants'] });
    expect(created.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nouveau@test.ci',
        nom: 'Nouveau',
        prenom: 'Compte',
        permissions: ['gerants'],
        is_superadmin: false,
        password_hash: expect.stringMatching(/^\$2[aby]\$12\$/),
      }),
    );
  });

  it('201 : permissions absentes → tableau vide', async () => {
    const check = fakeChain({ data: null, error: null });
    const created = fakeChain({ data: { id: 'n2', email: 'n2@test.ci' }, error: null });
    stubAdmins(check, created);

    const res = await request(app)
      .post('/api/admin/admins')
      .set(SUPER_AUTH)
      .send({ email: 'n2@test.ci', password: 'Secret123', nom: 'N', prenom: 'P' });

    expect(res.status).toBe(201);
    expect(created.insert).toHaveBeenCalledWith(expect.objectContaining({ permissions: [] }));
  });
});

describe('PATCH /api/admin/admins/:id', () => {
  it('403 pour un admin non-superadmin', async () => {
    stubLimitedAdmin([]);

    const res = await request(app)
      .patch('/api/admin/admins/autre-1')
      .set(LIMIT_AUTH)
      .send({ nom: 'X' });

    expect(res.status).toBe(403);
  });

  it('404 si le compte n’existe pas', async () => {
    const target = fakeChain({ data: null, error: null });
    stubAdmins(target);

    const res = await request(app)
      .patch('/api/admin/admins/inconnu')
      .set(SUPER_AUTH)
      .send({ nom: 'X' });

    expect(res.status).toBe(404);
  });

  it('400 si aucun champ n’est fourni', async () => {
    const res = await request(app).patch('/api/admin/admins/admin-2').set(SUPER_AUTH).send({});

    expect(res.status).toBe(400);
  });

  it('409 si le nouvel email est déjà pris par un autre compte', async () => {
    const target = fakeChain({ data: { id: 'admin-2', is_superadmin: false }, error: null });
    const clash = fakeChain({ data: { id: 'admin-9' }, error: null });
    stubAdmins(target, clash);

    const res = await request(app)
      .patch('/api/admin/admins/admin-2')
      .set(SUPER_AUTH)
      .send({ email: 'deja@test.ci' });

    expect(res.status).toBe(409);
  });

  it('409 si on retire le statut du dernier superadmin', async () => {
    const target = fakeChain({ data: { id: 'admin-1', is_superadmin: true }, error: null });
    const supers = fakeChain({ data: [{ id: 'admin-1' }], error: null });
    stubAdmins(target, supers);

    const res = await request(app)
      .patch('/api/admin/admins/admin-1')
      .set(SUPER_AUTH)
      .send({ is_superadmin: false });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Impossible de retirer le statut du dernier superadmin' });
  });

  it('200 : met à jour les permissions et horodate updated_at', async () => {
    const target = fakeChain({ data: { id: 'admin-2', is_superadmin: false }, error: null });
    const updated = fakeChain({
      data: { id: 'admin-2', permissions: ['gerants', 'stats'], is_superadmin: false },
      error: null,
    });
    stubAdmins(target, updated);

    const res = await request(app)
      .patch('/api/admin/admins/admin-2')
      .set(SUPER_AUTH)
      .send({ permissions: ['gerants', 'stats'] });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ['gerants', 'stats'],
        updated_at: expect.any(String),
      }),
    );
  });

  it('200 : réinitialise le mot de passe avec un hash bcrypt (jamais en clair)', async () => {
    const target = fakeChain({ data: { id: 'admin-2', is_superadmin: false }, error: null });
    const updated = fakeChain({ data: { id: 'admin-2' }, error: null });
    stubAdmins(target, updated);

    const res = await request(app)
      .patch('/api/admin/admins/admin-2')
      .set(SUPER_AUTH)
      .send({ password: 'Nouveau123' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ password_hash: expect.stringMatching(/^\$2[aby]\$12\$/) }),
    );
    expect(JSON.stringify(res.body)).not.toContain('Nouveau123');
  });

  it('200 : retire le statut superadmin quand un autre superadmin existe', async () => {
    const target = fakeChain({ data: { id: 'admin-2', is_superadmin: true }, error: null });
    const supers = fakeChain({ data: [{ id: 'admin-1' }, { id: 'admin-2' }], error: null });
    const updated = fakeChain({ data: { id: 'admin-2', is_superadmin: false }, error: null });
    stubAdmins(target, supers, updated);

    const res = await request(app)
      .patch('/api/admin/admins/admin-2')
      .set(SUPER_AUTH)
      .send({ is_superadmin: false });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_superadmin: false }),
    );
  });
});

describe('DELETE /api/admin/admins/:id', () => {
  it('403 pour un admin non-superadmin', async () => {
    stubLimitedAdmin([]);

    const res = await request(app).delete('/api/admin/admins/autre-1').set(LIMIT_AUTH);

    expect(res.status).toBe(403);
  });

  it('400 : impossible de supprimer son propre compte', async () => {
    const res = await request(app).delete('/api/admin/admins/admin-1').set(SUPER_AUTH);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  });

  it('404 si le compte n’existe pas', async () => {
    const target = fakeChain({ data: null, error: null });
    stubAdmins(target);

    const res = await request(app).delete('/api/admin/admins/inconnu').set(SUPER_AUTH);

    expect(res.status).toBe(404);
  });

  it('409 : impossible de supprimer le dernier superadmin', async () => {
    const target = fakeChain({ data: { id: 'admin-9', is_superadmin: true }, error: null });
    const supers = fakeChain({ data: [{ id: 'admin-9' }], error: null });
    stubAdmins(target, supers);

    const res = await request(app).delete('/api/admin/admins/admin-9').set(SUPER_AUTH);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Impossible de supprimer le dernier superadmin' });
  });

  it('204 : supprime un compte normal', async () => {
    const target = fakeChain({ data: { id: 'admin-2', is_superadmin: false }, error: null });
    const deleted = fakeChain({ data: null, error: null });
    stubAdmins(target, deleted);

    const res = await request(app).delete('/api/admin/admins/admin-2').set(SUPER_AUTH);

    expect(res.status).toBe(204);
    expect(deleted.delete).toHaveBeenCalled();
    expect(deleted.eq).toHaveBeenCalledWith('id', 'admin-2');
  });

  it('204 : supprime un superadmin quand un autre en reste', async () => {
    const target = fakeChain({ data: { id: 'admin-9', is_superadmin: true }, error: null });
    const supers = fakeChain({ data: [{ id: 'admin-1' }, { id: 'admin-9' }], error: null });
    const deleted = fakeChain({ data: null, error: null });
    stubAdmins(target, supers, deleted);

    const res = await request(app).delete('/api/admin/admins/admin-9').set(SUPER_AUTH);

    expect(res.status).toBe(204);
  });
});

describe('GET /api/admin/me expose le périmètre', () => {
  it('200 : renvoie is_superadmin et permissions', async () => {
    const me = fakeChain({
      data: {
        id: 'admin-2',
        email: 'limite@test.ci',
        nom: 'Limite',
        prenom: 'Compte',
        is_superadmin: false,
        permissions: ['gerants'],
      },
      error: null,
    });
    useSupabaseTables(supabaseAdmin.from, { admins: me });

    const res = await request(app).get('/api/admin/me').set(LIMIT_AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'admin-2',
      is_superadmin: false,
      permissions: ['gerants'],
    });
  });
});

describe('hachage des mots de passe', () => {
  it('le hash produit vérifie bien le mot de passe de création', async () => {
    const check = fakeChain({ data: null, error: null });
    const created = fakeChain({ data: { id: 'n3', email: 'n3@test.ci' }, error: null });
    stubAdmins(check, created);

    await request(app)
      .post('/api/admin/admins')
      .set(SUPER_AUTH)
      .send({ email: 'n3@test.ci', password: 'Secret123', nom: 'N', prenom: 'P' });

    const inserted = created.insert.mock.calls[0]?.[0] as { password_hash: string };
    expect(await bcrypt.compare('Secret123', inserted.password_hash)).toBe(true);
    expect(inserted.password_hash).not.toBe('Secret123');
  });
});
