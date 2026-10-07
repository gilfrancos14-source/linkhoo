import { Server as NetServer } from 'node:net';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { fakeChain } from './testHelpers/supertestApp';

interface SupabaseMockState {
  supabasePublic: { from: Mock };
  supabaseAdmin: { from: Mock; rpc: Mock };
}

/**
 * `src/index.ts` lit les variables d'environnement au chargement (et appelle
 * process.exit(1) en cas de manque) : elles sont figées AVANT l'import du
 * module. NODE_ENV n'est jamais `production` ici, ce qui garde l'origine CORS
 * par défaut (localhost:5173) active.
 */
const envGuard = vi.hoisted(() => {
  const keys = [
    'NODE_ENV',
    'TRUST_PROXY',
    'ALLOWED_ORIGINS',
    'APP_PUBLIC_URL',
    'CLERK_SECRET_KEY',
    'ADMIN_JWT_SECRET',
    'FEDAPAY_PUBLIC_KEY',
    'FEDAPAY_SECRET_KEY',
    'FEDAPAY_WEBHOOK_SECRET',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'PORT',
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};
  for (const key of keys) {
    savedEnv[key] = process.env[key];
  }

  process.env.NODE_ENV = 'test';
  process.env.CLERK_SECRET_KEY ??= 'sk_clerk_index_test';
  process.env.ADMIN_JWT_SECRET ??= 'secret-admin-index-test';
  process.env.FEDAPAY_PUBLIC_KEY ??= 'pk_index_test';
  process.env.FEDAPAY_SECRET_KEY ??= 'sk_index_test';
  process.env.FEDAPAY_WEBHOOK_SECRET = 'whsec_index_test';
  process.env.SUPABASE_URL ??= 'https://ilehya-index-test.supabase.co';
  process.env.SUPABASE_ANON_KEY ??= 'anon-index-test';
  process.env.SUPABASE_SERVICE_KEY ??= 'service-index-test';
  delete process.env.TRUST_PROXY;
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.APP_PUBLIC_URL;

  return { keys, savedEnv };
});

const supabaseState = vi.hoisted(() => ({ mocks: null as SupabaseMockState | null }));

vi.mock('./config/supabase', async () => {
  const helper = await import('./testHelpers/supertestApp');
  const mocks = helper.createSupabaseMock();
  supabaseState.mocks = mocks as unknown as SupabaseMockState;
  return mocks;
});

/**
 * `src/index.ts` appelle `app.listen(port)` à l'import. Le prototype est donc
 * neutralisé pendant la seule durée de l'import (supertest a besoin du vrai
 * `listen` juste après) : aucun socket n'est ouvert.
 */
async function importIndex(): Promise<typeof import('./index')> {
  const proto = NetServer.prototype as unknown as Record<string, unknown>;
  const originalListen = proto.listen;
  proto.listen = function listen(this: NetServer) {
    return this;
  };
  try {
    return await import('./index');
  } finally {
    proto.listen = originalListen;
  }
}

function emptyChain() {
  return fakeChain({ data: [], error: null });
}

function resetSupabaseMocks(): void {
  const mocks = supabaseState.mocks;
  if (!mocks) throw new Error('Le mock de config/supabase n’a pas été enregistré');
  mocks.supabasePublic.from.mockImplementation(emptyChain);
  mocks.supabaseAdmin.from.mockImplementation(emptyChain);
  mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [], error: null });
}

// Hooks de niveau fichier : le second montage (production) s'exécute dans un
// describe frère, donc la restauration de l'environnement doit attendre la fin
// du fichier — sinon les variables requises par src/index.ts auraient disparu
// avant le second import.
let app: Express;

beforeAll(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const indexModule = await importIndex();
  app = indexModule.default;
  resetSupabaseMocks();
}, 20000);

afterAll(() => {
  vi.restoreAllMocks();
  for (const key of envGuard.keys) {
    const value = envGuard.savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('montage de src/index.ts', () => {
  it('sert /api/health avec un horodatage ISO', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('applique les en-têtes de sécurité helmet et masque x-powered-by', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('met en cache publiquement les endpoints publics de la home', async () => {
    const res = await request(app).get('/api/banners');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=0, stale-while-revalidate=300');
  });

  it('ne pose pas de Cache-Control sur un endpoint hors liste', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('expose GET /api/rooms (paginé via fetchAllRows)', async () => {
    const res = await request(app).get('/api/rooms');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('expose GET /api/rooms/popular', async () => {
    const res = await request(app).get('/api/rooms/popular');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('expose GET /api/reviews/featured', async () => {
    const res = await request(app).get('/api/reviews/featured');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('expose GET /api/tourism (partition big/small) et le met en cache publiquement', async () => {
    const res = await request(app).get('/api/tourism?market=CI');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ big: [], small: [] });
    expect(res.headers['cache-control']).toBe('public, max-age=0, stale-while-revalidate=300');
  });

  it('refuse /api/admin/me sans jeton admin', async () => {
    const res = await request(app).get('/api/admin/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification manquant" });
  });

  it('refuse /api/auth/me sans jeton Clerk', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification manquant" });
  });

  it('refuse /api/gerants/me sans jeton Clerk', async () => {
    const res = await request(app).get('/api/gerants/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification manquant" });
  });

  it('refuse /api/rooms/mine sans jeton Clerk', async () => {
    const res = await request(app).get('/api/rooms/mine');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token d'authentification manquant" });
  });

  it('compte les écritures /api (401 mais en-têtes de rate limit draft-7)', async () => {
    const res = await request(app).post('/api/categories');

    expect(res.status).toBe(401);
    expect(res.headers.ratelimit).toContain('limit=200');
    expect(res.headers['ratelimit-policy']).toBe('200;w=900');
  });

  it('autorise l’origine de développement et refuse les autres', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const refused = await request(app).get('/api/health').set('Origin', 'https://evil.test');
    expect(refused.status).toBe(200);
    expect(refused.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('autorise les préflights OPTIONS /api', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('répond 404 sur une route /api inconnue', async () => {
    const res = await request(app).get('/api/inconnue');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route introuvable' });
  });

  it('répond 404 hors /api', async () => {
    const res = await request(app).get('/route-inconnue');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route introuvable' });
  });

  it('transforme une erreur Supabase en 500 masqué', async () => {
    const fromPublic = supabaseState.mocks!.supabasePublic.from;
    fromPublic.mockImplementation(() => {
      throw new Error('connexion refusée');
    });

    try {
      const res = await request(app).get('/api/banners');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
    } finally {
      fromPublic.mockImplementation(emptyChain);
    }
  });

  it('répond 400 à un corps JSON malformé', async () => {
    const res = await request(app)
      .post('/api/newsletter')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('rejette le webhook FedaPay dont la signature est invalide', async () => {
    const res = await request(app)
      .post('/api/premium/webhook')
      .set('x-fedapay-signature', 'signature-fausse')
      .send({ name: 'transaction.approved' });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Webhook signature invalide');
  });

  it('accepte 10 inscriptions newsletter puis renvoie 429 à la 11e', async () => {
    for (let index = 0; index < 10; index++) {
      const res = await request(app).post('/api/newsletter').send({ email: `lecteur${index}@test.ci` });
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post('/api/newsletter').send({ email: 'onzieme@test.ci' });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Trop de requêtes, veuillez réessayer plus tard' });
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('plafonne l’émission d’identités de visiteur sur /featured (C1)', async () => {
    for (let index = 0; index < 10; index++) {
      const res = await request(app).get('/api/boosts/featured');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/api/boosts/featured');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: 'Trop de nouvelles sessions de suivi, veuillez réessayer plus tard',
    });
  });

  it('compresse en gzip les réponses plus lourdes que le seuil', async () => {
    const rooms = Array.from({ length: 20 }, (_, index) => ({
      id: `room-${index}`,
      title: `Chambre ${index} avec vue sur la lagune`,
      description: 'Description volontairement longue pour dépasser le seuil de compression. '.repeat(3),
    }));
    const fromPublic = supabaseState.mocks!.supabasePublic.from;
    fromPublic.mockImplementation(() => fakeChain({ data: rooms, error: null }));

    try {
      const res = await request(app).get('/api/rooms').set('Accept-Encoding', 'gzip');

      expect(res.status).toBe(200);
      expect(res.headers['content-encoding']).toBe('gzip');
      expect(res.body).toHaveLength(20);
      expect(res.body[0].id).toBe('room-0');
    } finally {
      fromPublic.mockImplementation(emptyChain);
    }
  });

  it('épuise le quota d’écritures /api (200 par fenêtre de 15 min)', async () => {
    const statuses: number[] = [];
    let blockedBody: { error?: string } = {};
    let blockedRateLimit = '';

    for (let attempt = 0; attempt < 210 && statuses.at(-1) !== 429; attempt++) {
      const res = await request(app).post('/api/categories');
      statuses.push(res.status);
      if (res.status === 429) {
        blockedBody = res.body;
        blockedRateLimit = res.headers.ratelimit ?? '';
      }
    }

    expect(statuses.at(-1)).toBe(429);
    expect(statuses.slice(0, -1).every((status) => status === 401)).toBe(true);
    expect(blockedBody).toEqual({ error: 'Trop de requêtes, veuillez réessayer plus tard' });
    expect(blockedRateLimit).toContain('remaining=0');
  }, 30000);
});

describe('montage de src/index.ts en production', () => {
  let prodApp: Express;

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOWED_ORIGINS', 'https://app.ilehya.com');
    vi.stubEnv('APP_PUBLIC_URL', 'https://app.ilehya.com');
    // resetModules : sans ça, `import('./index')` est servi depuis le cache et
    // le second montage garderait la configuration CORS du premier.
    vi.resetModules();
    const indexModule = await importIndex();
    prodApp = indexModule.default;
  }, 20000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('n’accepte que les origines déclarées', async () => {
    const allowed = await request(prodApp).get('/api/health').set('Origin', 'https://app.ilehya.com');

    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.ilehya.com');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
  });

  it('refuse l’origine de développement par défaut', async () => {
    const refused = await request(prodApp).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(refused.status).toBe(200);
    expect(refused.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('interrompt le démarrage si APP_PUBLIC_URL manquant en production', async () => {
    const exitSpy = vi.spyOn(process, 'exit');
    exitSpy.mockImplementation(() => {
      throw new Error('process.exit intercepté');
    });
    vi.stubEnv('APP_PUBLIC_URL', '');
    vi.resetModules();

    let importFailed = false;
    try {
      await importIndex();
    } catch {
      importFailed = true;
    }

    expect(importFailed).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});

describe('montage de src/index.ts derrière un reverse proxy', () => {
  let proxyApp: Express;

  beforeAll(async () => {
    vi.stubEnv('TRUST_PROXY', '2');
    vi.resetModules();
    const indexModule = await importIndex();
    proxyApp = indexModule.default;
  }, 20000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('active trust proxy avec le nombre de sauts déclaré', async () => {
    expect(proxyApp.get('trust proxy')).toBe(2);

    const res = await request(proxyApp).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('interrompt le démarrage si TRUST_PROXY est invalide', async () => {
    const exitSpy = vi.spyOn(process, 'exit');
    exitSpy.mockImplementation(() => {
      throw new Error('process.exit intercepté');
    });
    vi.stubEnv('TRUST_PROXY', 'vrai');
    vi.resetModules();

    let importFailed = false;
    try {
      await importIndex();
    } catch {
      importFailed = true;
    }

    const exitCalls = exitSpy.mock.calls.length;
    const exitCode = exitSpy.mock.calls[0]?.[0];
    exitSpy.mockRestore();
    vi.unstubAllEnvs();

    expect(importFailed).toBe(true);
    expect(exitCalls).toBe(1);
    expect(exitCode).toBe(1);
  });
});
