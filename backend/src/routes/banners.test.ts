import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import bannersRouter from './banners';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  clerkBearer,
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

const app = buildTestApp('/api/banners', bannersRouter);

const validBanner = {
  section: 'promos',
  img: 'https://cdn.example.com/promo.webp',
  alt: 'Promo rentrée',
  link: '/promos/rentree',
  market: 'CI',
  order: 2,
};

const bearer = () => `Bearer ${adminToken()}`;

let publicChain: FakeChain;
let adminChain: FakeChain;

beforeEach(() => {
  vi.clearAllMocks();
  publicChain = fakeChain({ data: [], error: null });
  adminChain = fakeChain({ data: null, error: null });
  vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);
  vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);
});

describe('GET /api/banners', () => {
  it('200 : renvoie la liste triée puis filtrée par marché et section', async () => {
    publicChain = fakeChain({ data: [{ id: 'b1', section: 'promos' }], error: null });
    vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);

    const res = await request(app).get('/api/banners?market=CI&section=promos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'b1', section: 'promos' }]);
    expect(publicChain.order).toHaveBeenCalledWith('order', { ascending: true });
    expect(publicChain.eq).toHaveBeenCalledWith('market', 'CI');
    expect(publicChain.eq).toHaveBeenCalledWith('section', 'promos');
  });

  it('200 : renvoie les bannières sans paramètre', async () => {
    const res = await request(app).get('/api/banners');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(publicChain.eq).not.toHaveBeenCalled();
  });

  it('400 sur un marché inconnu', async () => {
    const res = await request(app).get('/api/banners?market=XX');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Paramètres invalides' });
    expect(supabasePublic.from).not.toHaveBeenCalled();
  });

  it('400 sur une section inconnue', async () => {
    const res = await request(app).get('/api/banners?section=accueil');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Section invalide' });
    expect(publicChain.eq).not.toHaveBeenCalled();
  });

  it('400 quand la section est répétée (paramètre non scalaire)', async () => {
    const res = await request(app).get('/api/banners?section=popular&section=events');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Section invalide' });
    expect(publicChain.eq).not.toHaveBeenCalled();
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    publicChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);

    const res = await request(app).get('/api/banners?market=CI');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('POST /api/banners', () => {
  it('401 sans jeton', async () => {
    const res = await request(app).post('/api/banners').send(validBanner);

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('401 avec un jeton Clerk (non admin)', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', clerkBearer('user_1'))
      .send(validBanner);

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 si la section manque', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', bearer())
      .send({
        img: validBanner.img,
        alt: validBanner.alt,
        link: validBanner.link,
        market: validBanner.market,
        order: validBanner.order,
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Données de bannière invalides' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 si un champ inconnu est présent (strict)', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', bearer())
      .send({ ...validBanner, titre: 'Bannière' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Données de bannière invalides' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 si order n’est pas un entier entre 0 et 10000', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', bearer())
      .send({ ...validBanner, order: 1.5 });

    expect(res.status).toBe(400);

    const resHaut = await request(app)
      .post('/api/banners')
      .set('Authorization', bearer())
      .send({ ...validBanner, order: 10_001 });

    expect(resHaut.status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('201 : insère la bannière avec un id généré', async () => {
    adminChain = fakeChain({ data: { id: 'b1', ...validBanner }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', bearer())
      .send(validBanner);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('b1');
    expect(adminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), section: 'promos', market: 'CI' }),
    );
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', bearer())
      .send(validBanner);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('PUT /api/banners/:id', () => {
  it('401 sans jeton', async () => {
    const res = await request(app).put('/api/banners/b1').send({ order: 5 });

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .put('/api/banners/%20')
      .set('Authorization', bearer())
      .send({ order: 5 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Données de bannière invalides' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un champ invalide', async () => {
    const res = await request(app)
      .put('/api/banners/b1')
      .set('Authorization', bearer())
      .send({ order: -1 });

    expect(res.status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un champ inconnu (strict)', async () => {
    const res = await request(app)
      .put('/api/banners/b1')
      .set('Authorization', bearer())
      .send({ section: 'popular', inconnu: true });

    expect(res.status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('404 quand la bannière n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/banners/inconnue')
      .set('Authorization', bearer())
      .send({ order: 5 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Bannière introuvable' });
  });

  it('200 : met à jour la bannière', async () => {
    adminChain = fakeChain({ data: { id: 'b1', order: 5 }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/banners/b1')
      .set('Authorization', bearer())
      .send({ order: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'b1', order: 5 });
    expect(adminChain.update).toHaveBeenCalledWith({ alt: '', order: 5 });
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('200 : un corps vide garde le défaut alt et touche la bannière', async () => {
    adminChain = fakeChain({ data: { id: 'b1', alt: '' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/banners/b1')
      .set('Authorization', bearer())
      .send({});

    expect(res.status).toBe(200);
    expect(adminChain.update).toHaveBeenCalledWith({ alt: '' });
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/banners/b1')
      .set('Authorization', bearer())
      .send({ order: 5 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('DELETE /api/banners/:id', () => {
  it('401 sans jeton', async () => {
    const res = await request(app).delete('/api/banners/b1');

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un identifiant vide', async () => {
    const res = await request(app).delete('/api/banners/%20').set('Authorization', bearer());

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Identifiant invalide' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('404 quand la bannière n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app).delete('/api/banners/inconnue').set('Authorization', bearer());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Bannière introuvable' });
  });

  it('204 : supprime la bannière', async () => {
    adminChain = fakeChain({ data: { id: 'b1' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app).delete('/api/banners/b1').set('Authorization', bearer());

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(adminChain.delete).toHaveBeenCalled();
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    adminChain = fakeChain({ data: null, error: { message: 'boom' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app).delete('/api/banners/b1').set('Authorization', bearer());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});
