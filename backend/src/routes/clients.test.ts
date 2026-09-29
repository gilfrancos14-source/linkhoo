import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import clientsRouter from './clients';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { supabaseAdmin } from '../config/supabase';
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

const app = buildTestApp('/api/clients', clientsRouter, {
  middlewares: [requireClerkAuth],
});

const validClient = {
  clerk_user_id: 'user_1',
  email: 'client@exemple.ci',
  nom: 'Koffi',
  prenom: 'Aya',
  telephone: '+225 07 00 00 00',
};

type TableName = 'clients' | 'gerants';

let clients: FakeChain;
let gerants: FakeChain;

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>>): void {
  useSupabaseTables(supabaseAdmin.from, { clients, gerants, ...tables });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  clients = fakeChain({ data: null, error: null });
  gerants = fakeChain({ data: null, error: null });
  stubTables({});
});

describe('GET /api/clients/me', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/clients/me');

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('401 sur un token Clerk invalide', async () => {
    const res = await request(app).get('/api/clients/me').set('Authorization', 'Bearer bogus');

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('403 si le compte n’est pas un client', async () => {
    stubTables({ clients: fakeChain({ data: null, error: null }) });

    const res = await request(app).get('/api/clients/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Accès réservé aux comptes client', role: 'client' });
  });

  it('404 si le profil client n’existe pas encore côté handler', async () => {
    stubTables({
      clients: [
        fakeChain({ data: { id: 'c1' }, error: null }),
        fakeChain({ data: null, error: null }),
      ],
    });

    const res = await request(app).get('/api/clients/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Profil client introuvable' });
  });

  it('200 : renvoie le profil du client connecté', async () => {
    const me = fakeChain({ data: { id: 'c1', clerk_user_id: 'user_1', nom: 'Koffi' }, error: null });
    stubTables({
      clients: [fakeChain({ data: { id: 'c1' }, error: null }), me],
    });

    const res = await request(app).get('/api/clients/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'c1', clerk_user_id: 'user_1', nom: 'Koffi' });
    expect(me.eq).toHaveBeenCalledWith('clerk_user_id', 'user_1');
  });

  it('500 quand Supabase renvoie une erreur au niveau du middleware', async () => {
    stubTables({ clients: fakeChain({ data: null, error: { message: 'boom' } }) });

    const res = await request(app).get('/api/clients/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });

  it('500 quand Supabase renvoie une erreur dans le handler', async () => {
    stubTables({
      clients: [
        fakeChain({ data: { id: 'c1' }, error: null }),
        fakeChain({ data: null, error: { message: 'boom' } }),
      ],
    });

    const res = await request(app).get('/api/clients/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('PATCH /api/clients/me', () => {
  it('401 sans token', async () => {
    const res = await request(app).patch('/api/clients/me').send({ nom: 'Koffi' });

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un champ inconnu (strict)', async () => {
    stubTables({ clients: fakeChain({ data: { id: 'c1' }, error: null }) });

    const res = await request(app)
      .patch('/api/clients/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ email: 'nouveau@exemple.ci' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Données invalides');
    expect(res.body.details).toBeDefined();
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('400 sur un nom trop long', async () => {
    stubTables({ clients: fakeChain({ data: { id: 'c1' }, error: null }) });

    const res = await request(app)
      .patch('/api/clients/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ nom: 'x'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Données invalides');
  });

  it('400 quand le corps est vide', async () => {
    stubTables({ clients: fakeChain({ data: { id: 'c1' }, error: null }) });

    const res = await request(app)
      .patch('/api/clients/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Aucune donnée à modifier' });
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('404 si le profil client est introuvable', async () => {
    stubTables({
      clients: [
        fakeChain({ data: { id: 'c1' }, error: null }),
        fakeChain({ data: null, error: null }),
      ],
    });

    const res = await request(app)
      .patch('/api/clients/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ nom: 'Koffi' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Profil client introuvable' });
  });

  it('200 : met à jour le profil du client connecté', async () => {
    const updated = fakeChain({ data: { id: 'c1', nom: 'Koffi' }, error: null });
    stubTables({
      clients: [
        fakeChain({ data: { id: 'c1' }, error: null }),
        fakeChain({ data: { id: 'c1' }, error: null }),
        updated,
      ],
    });

    const res = await request(app)
      .patch('/api/clients/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ nom: 'Koffi' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'c1', nom: 'Koffi' });
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ nom: 'Koffi', updated_at: expect.any(String) }),
    );
    expect(updated.eq).toHaveBeenCalledWith('clerk_user_id', 'user_1');
  });

  it('500 quand la mise à jour échoue', async () => {
    stubTables({
      clients: [
        fakeChain({ data: { id: 'c1' }, error: null }),
        fakeChain({ data: { id: 'c1' }, error: null }),
        fakeChain({ data: null, error: { message: 'boom' } }),
      ],
    });

    const res = await request(app)
      .patch('/api/clients/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ nom: 'Koffi' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});

describe('POST /api/clients', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/clients').send(validClient);

    expect(res.status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un email invalide', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validClient, email: 'pas-un-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Données invalides');
    expect(res.body.details).toBeDefined();
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('403 si on tente de créer le profil d’un autre utilisateur', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validClient, clerk_user_id: 'user_autre' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Vous ne pouvez créer que votre propre profil' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('409 si le compte est déjà enregistré comme gérant', async () => {
    stubTables({ gerants: fakeChain({ data: { id: 'g1' }, error: null }) });

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', clerkBearer('user_1'))
      .send(validClient);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Compte déjà enregistré comme gerant', role: 'gerant' });
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('409 si le profil client existe déjà', async () => {
    const existing = fakeChain({ data: { id: 'c1' }, error: null });
    stubTables({ clients: existing });

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', clerkBearer('user_1'))
      .send(validClient);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Profil client déjà existant', role: 'client' });
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('201 : crée le profil avec les valeurs par défaut', async () => {
    const insertChain = fakeChain({ data: { id: 'c1', ...validClient }, error: null });
    stubTables({ clients: [fakeChain({ data: null, error: null }), insertChain] });

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', clerkBearer('user_1'))
      .send({ clerk_user_id: 'user_1', email: 'CLIENT@Exemple.ci' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ id: 'c1' }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clerk_user_id: 'user_1',
        email: 'client@exemple.ci',
        nom: '',
        prenom: '',
        telephone: '',
      }),
    );
  });

  it('500 quand Supabase renvoie une erreur', async () => {
    stubTables({
      clients: [fakeChain({ data: null, error: null }), fakeChain({ data: null, error: { message: 'boom' } })],
    });

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', clerkBearer('user_1'))
      .send(validClient);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });
});
