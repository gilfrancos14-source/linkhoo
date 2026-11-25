import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authRouter from './auth';
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

const clerkUsers = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

const geoMock = vi.hoisted(() => ({ countryOfIp: vi.fn() }));

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({ users: clerkUsers })),
}));

vi.mock('../utils/geoIp', () => ({ countryOfIp: geoMock.countryOfIp }));

const app = buildTestApp('/api/auth', authRouter, {
  middlewares: [requireClerkAuth],
});

const clerkUser = {
  primaryEmailAddress: { emailAddress: 'jean@example.ci' },
  emailAddresses: [],
  // Numéro de téléphone CI (cohérent avec le marché 'CI' des tests).
  phoneNumbers: [{ phoneNumber: '+2250700000000' }],
  firstName: 'Jean',
  lastName: 'Kouassi',
  publicMetadata: {},
};

let clients: FakeChain;
let gerants: FakeChain;

function stubTables(tables: Partial<{ clients: FakeChain | FakeChain[]; gerants: FakeChain | FakeChain[] }> = {}): void {
  useSupabaseTables(supabaseAdmin.from, { clients, gerants, ...tables });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Par défaut : pays inconnu → contrôle ignoré (fail-open).
  geoMock.countryOfIp.mockResolvedValue(null);
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  clerkUsers.getUser.mockResolvedValue(clerkUser);
  clerkUsers.updateUser.mockResolvedValue({});
  clients = fakeChain({ data: null, error: null });
  gerants = fakeChain({ data: null, error: null });
  stubTables();
});

describe('GET /api/auth/me', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('200 : rôle lu dans le profil Supabase', async () => {
    clients = fakeChain({ data: { id: 'c1' }, error: null });
    stubTables();

    const res = await request(app).get('/api/auth/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: 'client', profile_role: 'client', clerk_role: null });
  });

  it('200 : rôle lu dans Clerk quand aucun profil nexiste', async () => {
    clerkUsers.getUser.mockResolvedValue({ ...clerkUser, publicMetadata: { role: 'gerant' } });

    const res = await request(app).get('/api/auth/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: 'gerant', profile_role: null, clerk_role: 'gerant' });
  });

  it('200 : Clerk indisponible ne casse pas la réponse', async () => {
    clerkUsers.getUser.mockRejectedValue(new Error('Clerk en panne'));

    const res = await request(app).get('/api/auth/me').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: null, profile_role: null, clerk_role: null });
  });

  it('200 : un rôle inconnu dans Clerk est ignoré', async () => {
    clerkUsers.getUser.mockResolvedValue({ ...clerkUser, publicMetadata: { role: 'admin' } });

    const res = await request(app).get('/api/auth/me').set('Authorization', clerkBearer('user_1'));

    expect(res.body.clerk_role).toBeNull();
    expect(res.body.role).toBeNull();
  });
});

describe('POST /api/auth/bootstrap', () => {
  it('400 sur un rôle inconnu', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('401 sans token', async () => {
    const res = await request(app).post('/api/auth/bootstrap').send({ role: 'client' });
    expect(res.status).toBe(401);
  });

  it('409 si le compte existe déjà avec un autre rôle', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'client' });

    expect(res.status).toBe(409);
    expect(res.body.role).toBe('gerant');
  });

  it('400 si Clerk ne renvoie aucune adresse email', async () => {
    clerkUsers.getUser.mockResolvedValue({
      ...clerkUser,
      primaryEmailAddress: null,
      emailAddresses: [],
    });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'client', market: 'CI' });

    expect(res.status).toBe(400);
  });

  it('400 : market manquant pour un compte client', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'client' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('market est requis pour un compte client');
  });

  it('201 : crée le profil client et pose le rôle Clerk', async () => {
    const roleCheck = fakeChain({ data: null, error: null });
    const existing = fakeChain({ data: null, error: null });
    const inserted = fakeChain({ data: null, error: null });
    stubTables({ clients: [roleCheck, existing, inserted] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'client', market: 'CI' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      role: 'client',
      profile_role: 'client',
      clerk_role: 'client',
      market: 'CI',
    });
    expect(inserted.insert).toHaveBeenCalledWith({
      clerk_user_id: 'user_1',
      email: 'jean@example.ci',
      nom: 'Kouassi',
      prenom: 'Jean',
      market: 'CI',
    });
    expect(clerkUsers.updateUser).toHaveBeenCalledWith('user_1', {
      publicMetadata: { role: 'client' },
    });
  });

  it('200 : le profil client existe déjà sur le même marché', async () => {
    const roleCheck = fakeChain({ data: { id: 'c1' }, error: null });
    const existing = fakeChain({ data: { id: 'c1', market: 'CI' }, error: null });
    stubTables({ clients: [roleCheck, existing] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'client', market: 'CI' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      role: 'client',
      profile_role: 'client',
      clerk_role: 'client',
      market: 'CI',
    });
    expect(existing.insert).not.toHaveBeenCalled();
    expect(clerkUsers.updateUser).toHaveBeenCalledWith('user_1', {
      publicMetadata: { role: 'client' },
    });
  });

  it('409 : client existant sur un autre marché → renvoie le marché réel', async () => {
    const roleCheck = fakeChain({ data: { id: 'c1' }, error: null });
    const existing = fakeChain({ data: { id: 'c1', market: 'CI' }, error: null });
    stubTables({ clients: [roleCheck, existing] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'client', market: 'BJ' });

    expect(res.status).toBe(409);
    expect(res.body.role).toBe('client');
    expect(res.body.market).toBe('CI');
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('400 : market manquant pour un compte gérant', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('market est requis pour un compte gérant');
  });

  it('201 : crée le profil gérant avec son market', async () => {
    const roleCheck = fakeChain({ data: null, error: null });
    const existing = fakeChain({ data: null, error: null });
    const inserted = fakeChain({ data: null, error: null });
    stubTables({ gerants: [roleCheck, existing, inserted] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'CI' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant', market: 'CI' });
    expect(inserted.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clerk_user_id: 'user_1',
        market: 'CI',
        phone: '+2250700000000',
      }),
    );
    expect(clerkUsers.updateUser).toHaveBeenCalledWith('user_1', {
      publicMetadata: { role: 'gerant' },
    });
  });

  it('400 si le market nest pas valide', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'XX' });
    expect(res.status).toBe(400);
  });

  it('403 si le téléphone Clerk ne correspond pas au marché déclaré', async () => {
    // Numéro du Bénin alors que le gérant s'inscrit sur le marché CI.
    clerkUsers.getUser.mockResolvedValue({
      ...clerkUser,
      phoneNumbers: [{ phoneNumber: '+22996000000' }],
    });
    stubTables({ gerants: [fakeChain({ data: null, error: null })] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'CI' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('GERANT_PHONE_MARKET_MISMATCH');
  });

  it('400 si le gérant na aucun numéro de téléphone', async () => {
    clerkUsers.getUser.mockResolvedValue({ ...clerkUser, phoneNumbers: [] });
    stubTables({ gerants: [fakeChain({ data: null, error: null })] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'CI' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('GERANT_PHONE_REQUIRED');
  });

  it('201 : profil gérant existant mais rôle absent de Clerk', async () => {
    const roleCheck = fakeChain({ data: null, error: null });
    const existing = fakeChain({ data: { id: 'g1', market: 'BJ' }, error: null });
    stubTables({ gerants: [roleCheck, existing] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'BJ' });

    expect(res.status).toBe(201);
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('409 : gérant existant sur un autre marché → renvoie le marché réel', async () => {
    const roleCheck = fakeChain({ data: { id: 'g1' }, error: null });
    const existing = fakeChain({ data: { id: 'g1', market: 'CI' }, error: null });
    stubTables({ gerants: [roleCheck, existing] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'BJ' });

    expect(res.status).toBe(409);
    expect(res.body.role).toBe('gerant');
    expect(res.body.market).toBe('CI');
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('200 : gérant existant sur le même marché → OK', async () => {
    const roleCheck = fakeChain({ data: { id: 'g1' }, error: null });
    const existing = fakeChain({ data: { id: 'g1', market: 'CI' }, error: null });
    stubTables({ gerants: [roleCheck, existing] });

    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', clerkBearer('user_1'))
      .send({ role: 'gerant', market: 'CI' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('gerant');
    expect(res.body.market).toBe('CI');
  });

  describe('contrôle géographique par IP', () => {
    it('403 si le pays de l’IP ne correspond pas au marché à l’inscription', async () => {
      geoMock.countryOfIp.mockResolvedValue({ countryCode: 'BJ', country: 'Bénin' });
      const roleCheck = fakeChain({ data: null, error: null });
      const existing = fakeChain({ data: null, error: null });
      const inserted = fakeChain({ data: null, error: null });
      stubTables({ gerants: [roleCheck, existing, inserted] });

      const res = await request(app)
        .post('/api/auth/bootstrap')
        .set('Authorization', clerkBearer('user_1'))
        .send({ role: 'gerant', market: 'CI' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('GERANT_COUNTRY_MARKET_MISMATCH');
      expect(res.body.country).toBe('BJ');
      expect(res.body.market).toBe('CI');
      expect(res.body.error).toContain('ne correspond pas au marché CI');
      expect(inserted.insert).not.toHaveBeenCalled();
      expect(clerkUsers.updateUser).not.toHaveBeenCalled();
    });

    it('403 si le pays de l’IP ne correspond pas au marché du profil existant', async () => {
      geoMock.countryOfIp.mockResolvedValue({ countryCode: 'SN', country: 'Sénégal' });
      const roleCheck = fakeChain({ data: { id: 'g1' }, error: null });
      const existing = fakeChain({ data: { id: 'g1', market: 'CI' }, error: null });
      stubTables({ gerants: [roleCheck, existing] });

      const res = await request(app)
        .post('/api/auth/bootstrap')
        .set('Authorization', clerkBearer('user_1'))
        .send({ role: 'gerant', market: 'CI' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('GERANT_COUNTRY_MARKET_MISMATCH');
      expect(clerkUsers.updateUser).not.toHaveBeenCalled();
    });

    it('201 si le pays de l’IP correspond au marché déclaré', async () => {
      geoMock.countryOfIp.mockResolvedValue({ countryCode: 'CI', country: "Côte d'Ivoire" });
      const roleCheck = fakeChain({ data: null, error: null });
      const existing = fakeChain({ data: null, error: null });
      const inserted = fakeChain({ data: null, error: null });
      stubTables({ gerants: [roleCheck, existing, inserted] });

      const res = await request(app)
        .post('/api/auth/bootstrap')
        .set('Authorization', clerkBearer('user_1'))
        .send({ role: 'gerant', market: 'CI' });

      expect(res.status).toBe(201);
      expect(inserted.insert).toHaveBeenCalled();
      expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({
        signup_country: 'CI',
        signup_country_name: "Côte d'Ivoire",
      }));
      expect(geoMock.countryOfIp).toHaveBeenCalled();
    });

    it('autorise (et journalise) quand le pays ne peut pas être résolu', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      geoMock.countryOfIp.mockResolvedValue(null);
      const roleCheck = fakeChain({ data: { id: 'g1' }, error: null });
      const existing = fakeChain({ data: { id: 'g1', market: 'CI' }, error: null });
      stubTables({ gerants: [roleCheck, existing] });

      const res = await request(app)
        .post('/api/auth/bootstrap')
        .set('Authorization', clerkBearer('user_1'))
        .send({ role: 'gerant', market: 'CI' });

      expect(res.status).toBe(200);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('ne contrôle pas le pays pour un compte client', async () => {
      const roleCheck = fakeChain({ data: null, error: null });
      const existing = fakeChain({ data: null, error: null });
      const inserted = fakeChain({ data: null, error: null });
      stubTables({ clients: [roleCheck, existing, inserted] });

      const res = await request(app)
        .post('/api/auth/bootstrap')
        .set('Authorization', clerkBearer('user_1'))
        .send({ role: 'client', market: 'CI' });

      expect(res.status).toBe(201);
      expect(geoMock.countryOfIp).not.toHaveBeenCalled();
    });
  });
});
