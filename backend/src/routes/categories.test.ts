import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import categoriesRouter from './categories';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
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

const app = buildTestApp('/api/categories', categoriesRouter);

const validCategory = {
  title: 'Meublé',
  img: 'https://cdn.example.com/meuble.webp',
  alt: 'Meublé à Abidjan',
  market: 'CI',
};

type TableName = 'gerants' | 'categories';

let publicChain: FakeChain;
let gerants: FakeChain;
let categories: FakeChain;

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>>): void {
  useSupabaseTables(supabaseAdmin.from, { gerants, categories, ...tables });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  publicChain = fakeChain({ data: [], error: null });
  gerants = fakeChain({ data: { market: 'CI', is_verified: true }, error: null });
  categories = fakeChain({ data: null, error: null });
  vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);
  stubTables({});
});

describe('GET /api/categories', () => {
  it('200 : renvoie la liste filtrée par marché', async () => {
    publicChain = fakeChain({ data: [{ id: 'c1', title: 'Meublé' }], error: null });
    vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);

    const res = await request(app).get('/api/categories?market=CI');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'c1', title: 'Meublé' }]);
    expect(publicChain.eq).toHaveBeenCalledWith('market', 'CI');
  });

  it('200 : renvoie toutes les catégories sans paramètre', async () => {
    publicChain = fakeChain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });
    vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(publicChain.eq).not.toHaveBeenCalled();
  });

  it('400 sur un marché inconnu', async () => {
    const res = await request(app).get('/api/categories?market=TG');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Paramètres invalides' });
    expect(supabasePublic.from).not.toHaveBeenCalled();
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    publicChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);

    const res = await request(app).get('/api/categories?market=CI');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('POST /api/categories', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/categories').send(validCategory);

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('401 sur un token Clerk invalide', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer bogus')
      .send(validCategory);

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 si le titre manque', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send({ img: validCategory.img, market: validCategory.market });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Données de catégorie invalides' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 si un champ inconnu est présent (strict)', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validCategory, slug: 'meuble' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Données de catégorie invalides' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('403 si le compte n’est pas gérant', async () => {
    stubTables({ gerants: fakeChain({ data: null, error: null }) });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send(validCategory);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Seuls les gérants vérifiés peuvent effectuer cette action' });
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('403 si le gérant n’est pas vérifié', async () => {
    stubTables({ gerants: fakeChain({ data: { market: 'CI', is_verified: false }, error: null }) });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send(validCategory);

    expect(res.status).toBe(403);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('403 si la catégorie est créée hors du marché du gérant', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validCategory, market: 'BJ' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'Vous ne pouvez créer des catégories que dans votre marché',
    });
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('201 : insère la catégorie avec un id généré', async () => {
    categories = fakeChain({ data: { id: 'c1', ...validCategory }, error: null });
    stubTables({});

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send(validCategory);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ id: 'c1', title: 'Meublé' }));
    expect(categories.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), market: 'CI' }),
    );
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    stubTables({ categories: fakeChain({ data: null, error: { message: 'boom' } }) });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', clerkBearer('user_1'))
      .send(validCategory);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('PUT /api/categories/:id', () => {
  it('401 sans token', async () => {
    const res = await request(app).put('/api/categories/c1').send({ title: 'X' });

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .put('/api/categories/%20')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Données de catégorie invalides' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un titre vide', async () => {
    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un champ inconnu (strict)', async () => {
    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X', slug: 'x' });

    expect(res.status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('403 si le compte n’est pas gérant', async () => {
    stubTables({ gerants: fakeChain({ data: null, error: null }) });

    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(403);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('404 quand la catégorie n’existe pas', async () => {
    stubTables({ categories: [fakeChain({ data: null, error: null })] });

    const res = await request(app)
      .put('/api/categories/inconnue')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Catégorie introuvable' });
  });

  it('403 si la catégorie appartient à un autre marché', async () => {
    const fetchChain = fakeChain({ data: { market: 'BJ' }, error: null });
    const updateChain = fakeChain({ data: null, error: null });
    stubTables({ categories: [fetchChain, updateChain] });

    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Vous ne pouvez modifier que les catégories de votre marché' });
    expect(updateChain.update).not.toHaveBeenCalled();
  });

  it('200 : met à jour la catégorie de son marché', async () => {
    const updated = fakeChain({ data: { id: 'c1', title: 'X', market: 'CI' }, error: null });
    stubTables({
      categories: [fakeChain({ data: { market: 'CI' }, error: null }), updated],
    });

    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'c1', title: 'X', market: 'CI' });
    expect(updated.update).toHaveBeenCalledWith({ alt: '', title: 'X' });
    expect(updated.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('404 quand la mise à jour ne renvoie aucune ligne', async () => {
    stubTables({
      categories: [
        fakeChain({ data: { market: 'CI' }, error: null }),
        fakeChain({ data: null, error: null }),
      ],
    });

    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Catégorie introuvable' });
  });

  it('500 quand la lecture initiale échoue', async () => {
    stubTables({
      categories: [fakeChain({ data: null, error: { message: 'boom' } })],
    });

    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });

  it('500 quand la mise à jour échoue', async () => {
    stubTables({
      categories: [
        fakeChain({ data: { market: 'CI' }, error: null }),
        fakeChain({ data: null, error: { message: 'boom' } }),
      ],
    });

    const res = await request(app)
      .put('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ title: 'X' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('DELETE /api/categories/:id', () => {
  it('401 sans token', async () => {
    const res = await request(app).delete('/api/categories/c1');

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .delete('/api/categories/%20')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Identifiant invalide' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('403 si le compte n’est pas gérant', async () => {
    stubTables({ gerants: fakeChain({ data: null, error: null }) });

    const res = await request(app)
      .delete('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(403);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('404 quand la catégorie n’existe pas', async () => {
    stubTables({ categories: [fakeChain({ data: null, error: null })] });

    const res = await request(app)
      .delete('/api/categories/inconnue')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Catégorie introuvable' });
  });

  it('403 si la catégorie appartient à un autre marché', async () => {
    const fetchChain = fakeChain({ data: { market: 'BJ' }, error: null });
    const deleteChain = fakeChain({ data: null, error: null });
    stubTables({ categories: [fetchChain, deleteChain] });

    const res = await request(app)
      .delete('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Vous ne pouvez supprimer que les catégories de votre marché' });
    expect(deleteChain.delete).not.toHaveBeenCalled();
  });

  it('204 : supprime la catégorie', async () => {
    const removed = fakeChain({ data: { id: 'c1' }, error: null });
    stubTables({
      categories: [fakeChain({ data: { market: 'CI' }, error: null }), removed],
    });

    const res = await request(app)
      .delete('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(removed.delete).toHaveBeenCalled();
    expect(removed.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('500 quand la lecture initiale échoue', async () => {
    stubTables({
      categories: [fakeChain({ data: null, error: { message: 'boom' } })],
    });

    const res = await request(app)
      .delete('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });

  it('500 quand la suppression échoue', async () => {
    stubTables({
      categories: [
        fakeChain({ data: { market: 'CI' }, error: null }),
        fakeChain({ data: null, error: { message: 'boom' } }),
      ],
    });

    const res = await request(app)
      .delete('/api/categories/c1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});
