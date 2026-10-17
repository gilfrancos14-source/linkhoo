import express from 'express';
import type { Request } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createClientLimiter,
  isAuthRequest,
  skipWriteQuota,
  userOrIpKey,
} from './rateLimiters';

const WINDOW_MS = 15 * 60 * 1000;

function buildApp(options?: { limit?: number }) {
  const app = express();
  const limiter = createClientLimiter({ limit: options?.limit, prefix: 'test' });
  app.post('/write', limiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/read', limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('createClientLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sous la limite : la requête passe et expose les en-têtes draft-7', async () => {
    const app = buildApp({ limit: 3 });

    const res = await request(app).post('/write');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers.ratelimit).toContain('limit=3');
    expect(res.headers.ratelimit).toContain('remaining=2');
    expect(res.headers['ratelimit-policy']).toBe('3;w=900');
    expect(res.headers['retry-after']).toBeUndefined();
  });

  it('à la limite : la dernière requête autorisée reste acceptée', async () => {
    const app = buildApp({ limit: 3 });

    for (let i = 0; i < 2; i++) {
      const partial = await request(app).post('/write');
      expect(partial.status).toBe(200);
    }

    const atLimit = await request(app).post('/write');
    expect(atLimit.status).toBe(200);
    expect(atLimit.headers.ratelimit).toContain('remaining=0');
  });

  it('dépassement : la requête au-delà de la limite reçoit 429', async () => {
    const app = buildApp({ limit: 3 });

    for (let i = 0; i < 3; i++) {
      await request(app).post('/write');
    }

    const blocked = await request(app).post('/write');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Trop de requêtes, veuillez réessayer plus tard' });
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('les requêtes GET ne sont jamais comptées (skip)', async () => {
    const app = buildApp({ limit: 1 });

    for (let i = 0; i < 5; i++) {
      const read = await request(app).get('/read');
      expect(read.status).toBe(200);
    }

    // Le compteur est toujours à zéro : la première écriture passe…
    expect((await request(app).post('/write')).status).toBe(200);
    // …et seule la seconde écriture atteint la limite de 1.
    expect((await request(app).post('/write')).status).toBe(429);
  });

  it('reset : l’expiration de la fenêtre remet le compteur à zéro', async () => {
    const app = buildApp({ limit: 1 });

    expect((await request(app).post('/write')).status).toBe(200);
    expect((await request(app).post('/write')).status).toBe(429);

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + WINDOW_MS + 1000);

      const afterWindow = await request(app).post('/write');
      expect(afterWindow.status).toBe(200);
      expect(afterWindow.headers.ratelimit).toContain('remaining=0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('limite par défaut : 60 écritures par fenêtre de 15 minutes', async () => {
    const app = buildApp();

    const res = await request(app).post('/write');

    expect(res.status).toBe(200);
    expect(res.headers.ratelimit).toContain('limit=60');
    expect(res.headers.ratelimit).toContain('remaining=59');
    expect(res.headers['ratelimit-policy']).toBe('60;w=900');
  });

  it('des préfixes distincts isolent les compteurs (pas de collision)', async () => {
    const app = express();
    const alpha = createClientLimiter({ limit: 1, prefix: 'alpha' });
    const beta = createClientLimiter({ limit: 1, prefix: 'beta' });
    app.post('/alpha', alpha, (_req, res) => res.json({ ok: true }));
    app.post('/beta', beta, (_req, res) => res.json({ ok: true }));

    // alpha consomme son unique jeton puis sature…
    expect((await request(app).post('/alpha')).status).toBe(200);
    expect((await request(app).post('/alpha')).status).toBe(429);
    // …sans entamer le quota de beta (même client/IP, préfixe différent).
    expect((await request(app).post('/beta')).status).toBe(200);
  });
});

function fakeReq(
  init: { method?: string; url?: string; auth?: { userId: string }; ip?: string } = {},
): Request {
  return {
    method: init.method ?? 'POST',
    originalUrl: init.url ?? '/api/x',
    url: init.url ?? '/api/x',
    auth: init.auth,
    ip: init.ip,
  } as unknown as Request;
}

describe('isAuthRequest', () => {
  it('reconnaît les routes de connexion, même avec query string', () => {
    expect(isAuthRequest(fakeReq({ url: '/api/auth' }))).toBe(true);
    expect(isAuthRequest(fakeReq({ url: '/api/auth/bootstrap' }))).toBe(true);
    expect(isAuthRequest(fakeReq({ url: '/api/auth/me?fresh=1' }))).toBe(true);
  });

  it('ne confond pas les préfixes voisins', () => {
    expect(isAuthRequest(fakeReq({ url: '/api/authz' }))).toBe(false);
    expect(isAuthRequest(fakeReq({ url: '/api/authenticity' }))).toBe(false);
    expect(isAuthRequest(fakeReq({ url: '/api/rooms' }))).toBe(false);
  });
});

describe('skipWriteQuota', () => {
  it('exclut les GET, la connexion et le tracking boost (limiteurs dédiés)', () => {
    expect(skipWriteQuota(fakeReq({ method: 'GET', url: '/api/rooms' }))).toBe(true);
    expect(skipWriteQuota(fakeReq({ method: 'POST', url: '/api/auth/bootstrap' }))).toBe(true);
    expect(skipWriteQuota(fakeReq({ method: 'POST', url: '/api/boosts/impression' }))).toBe(true);
    expect(skipWriteQuota(fakeReq({ method: 'POST', url: '/api/boosts/click?x=1' }))).toBe(true);
  });

  it('compte les vraies écritures', () => {
    expect(skipWriteQuota(fakeReq({ method: 'POST', url: '/api/rooms' }))).toBe(false);
    expect(skipWriteQuota(fakeReq({ method: 'DELETE', url: '/api/rooms/1' }))).toBe(false);
  });
});

describe('userOrIpKey', () => {
  it('privilégie l’utilisateur authentifié', () => {
    expect(userOrIpKey(fakeReq({ auth: { userId: 'user_a' }, ip: '10.0.0.1' }))).toBe('user_a');
  });

  it('retombe sur une clé IP stable sans utilisateur', () => {
    const a = userOrIpKey(fakeReq({ ip: '::ffff:127.0.0.1' }));
    const b = userOrIpKey(fakeReq({ ip: '::ffff:127.0.0.1' }));
    const c = userOrIpKey(fakeReq({ ip: '::ffff:127.0.0.2' }));

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('createClientLimiter — clé par utilisateur', () => {
  it('deux utilisateurs derrière la même IP ne se bloquent pas', async () => {
    const app = express();
    const limiter = createClientLimiter({ limit: 1, prefix: 'per-user' });
    app.use((req, _res, next) => {
      const user = req.header('x-test-user');
      if (user) req.auth = { userId: user };
      next();
    });
    app.post('/write', limiter, (_req, res) => res.json({ ok: true }));

    expect((await request(app).post('/write').set('x-test-user', 'u1')).status).toBe(200);
    expect((await request(app).post('/write').set('x-test-user', 'u1')).status).toBe(429);
    // Même IP (supertest → 127.0.0.1) mais utilisateur distinct : quota neuf.
    expect((await request(app).post('/write').set('x-test-user', 'u2')).status).toBe(200);
  });
});
