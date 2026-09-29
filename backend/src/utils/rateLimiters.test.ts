import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientLimiter } from './rateLimiters';

const WINDOW_MS = 15 * 60 * 1000;

function buildApp(options?: { limit?: number }) {
  const app = express();
  const limiter = createClientLimiter(options);
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
});
