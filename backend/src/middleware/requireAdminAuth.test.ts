import { Router } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAdminAuth, signAdminToken } from './requireAdminAuth';
import { adminToken, buildTestApp } from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

const router = Router();
router.get('/me', requireAdminAuth, (req, res) => {
  res.json({ admin: req.admin ?? null });
});

const app = buildTestApp('/api/secure', router);

describe('requireAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  });

  it('401 sans en-tête Authorization', async () => {
    const res = await request(app).get('/api/secure/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification manquant" });
  });

  it('401 pour un schéma d’authentification autre que Bearer', async () => {
    const res = await request(app).get('/api/secure/me').set('Authorization', 'Basic dXNlcjpwdw==');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 pour « bearer » en minuscules (casse sensible)', async () => {
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', `bearer ${adminToken()}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 pour « Bearer » sans espace final (en-tête non reconnu)', async () => {
    const res = await request(app).get('/api/secure/me').set('Authorization', 'Bearer');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 pour « Bearer » suivi d’espaces seuls (en-tête normalisé, jeton inexistant)', async () => {
    // Node/superagent trimment les espaces de fin : l’en-tête devient « Bearer ».
    const res = await request(app).get('/api/secure/me').set('Authorization', 'Bearer  ');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 pour un jeton blanc après « Bearer » (token non signé)', async () => {
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', 'Bearer jeton blanc');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  it('401 pour un jeton malformé', async () => {
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', 'Bearer jeton-absurde');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  it('401 pour un jeton signé avec un autre secret', async () => {
    const forged = jwt.sign({ adminId: 'intrus', email: 'intrus@test.ci' }, 'autre-secret');
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  it('401 pour un jeton expiré', async () => {
    const expired = jwt.sign(
      { adminId: 'admin-1', email: 'admin@test.ci' },
      process.env.ADMIN_JWT_SECRET!,
      { expiresIn: '-1h' },
    );
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  it('401 pour un JWT HS256 du secret admin sans claims admin', async () => {
    // Un jeton Clerk (sub/sid) signé avec le secret admin ne doit pas passer :
    // le middleware exige un adminId non vide.
    const clerkLike = jwt.sign({ sub: 'user_1', sid: 'sess' }, 'secret-de-test');
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', `Bearer ${clerkLike}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
    expect(res.body.admin).toBeUndefined();
  });

  it('401 pour un adminId vide ou non string', async () => {
    for (const payload of [{ adminId: '', email: 'a@test.ci' }, { adminId: 42, email: 'a@test.ci' }]) {
      const token = jwt.sign(payload, 'secret-de-test');
      const res = await request(app)
        .get('/api/secure/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token invalide ou expiré');
    }
  });

  it('200 : pose req.admin et appelle next()', async () => {
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', `Bearer ${adminToken({ adminId: 'a9', email: 'a9@test.ci' })}`);
    expect(res.status).toBe(200);
    expect(res.body.admin).toMatchObject({ adminId: 'a9', email: 'a9@test.ci' });
    expect(typeof res.body.admin.exp).toBe('number');
    expect(typeof res.body.admin.iat).toBe('number');
  });

  it('401 : n’exécute pas le handler suivant quand le jeton est refusé', async () => {
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', 'Bearer faux');
    expect(res.status).toBe(401);
    expect(res.body.admin).toBeUndefined();
  });
});

describe('signAdminToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  });

  it('produit un jeton accepté par requireAdminAuth (aller-retour)', async () => {
    const token = signAdminToken({ adminId: 'a42', email: 'signe@test.ci' });
    const res = await request(app)
      .get('/api/secure/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.admin).toMatchObject({ adminId: 'a42', email: 'signe@test.ci' });
  });

  it('signe avec une expiration de 24h', () => {
    const token = signAdminToken({ adminId: 'a1', email: 'a1@test.ci' });
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(86_400);
  });

  it('est rejeté quand le secret change après signature', () => {
    const token = signAdminToken({ adminId: 'a1', email: 'a1@test.ci' });
    process.env.ADMIN_JWT_SECRET = 'autre-secret';
    expect(() => jwt.verify(token, process.env.ADMIN_JWT_SECRET!)).toThrow();
    process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  });
});
