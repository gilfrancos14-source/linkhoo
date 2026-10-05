import express from 'express';
import type { RequestHandler, Router } from 'express';
import jwt from 'jsonwebtoken';
import { vi } from 'vitest';
import { errorHandler } from '../middleware/errorHandler';
import type { RawBodyRequest } from '../types/express';

type AnyFn = ReturnType<typeof vi.fn>;

export interface FakeChain {
  select: AnyFn;
  insert: AnyFn;
  update: AnyFn;
  upsert: AnyFn;
  delete: AnyFn;
  eq: AnyFn;
  neq: AnyFn;
  gt: AnyFn;
  gte: AnyFn;
  lt: AnyFn;
  lte: AnyFn;
  in: AnyFn;
  not: AnyFn;
  order: AnyFn;
  limit: AnyFn;
  range: AnyFn;
  single: AnyFn;
  maybeSingle: AnyFn;
  then: (onFulfilled: unknown, onRejected: unknown) => Promise<unknown>;
}

/**
 * Chaîne PostgREST simulée : chaque méthode d'agrégation renvoie la chaîne
 * elle-même (comme supabase-js), `single`/`maybeSingle` résolvent `result`,
 * et attendre la chaîne entière résout aussi `result` (les appels sans
 * terminal, type `await supabase.from('x').insert(...)`).
 */
export function fakeChain(result: { data?: unknown; error?: unknown; count?: number }): FakeChain {
  const chain = {} as FakeChain;
  const chainable = (): FakeChain => chain;

  chain.select = vi.fn(chainable);
  chain.insert = vi.fn(chainable);
  chain.update = vi.fn(chainable);
  chain.upsert = vi.fn(chainable);
  chain.delete = vi.fn(chainable);
  chain.eq = vi.fn(chainable);
  chain.neq = vi.fn(chainable);
  chain.gt = vi.fn(chainable);
  chain.gte = vi.fn(chainable);
  chain.lt = vi.fn(chainable);
  chain.lte = vi.fn(chainable);
  chain.in = vi.fn(chainable);
  chain.not = vi.fn(chainable);
  chain.order = vi.fn(chainable);
  chain.limit = vi.fn(chainable);
  chain.range = vi.fn(chainable);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  // La chaîne doit être « thenable » pour être awaitable comme supabase-js.
  // oxlint-disable-next-line unicorn/no-thenable
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(
      onFulfilled as (value: unknown) => unknown,
      onRejected as (reason: unknown) => unknown,
    );

  return chain;
}

type FromLike = {
  mockImplementation(impl: (table: string) => unknown): unknown;
};

/**
 * Branche `supabaseAdmin.from` sur un routage par table : chaque table reçoit
 * sa propre chaîne, et une table dont on passe un tableau consomme les chaînes
 * dans l'ordre des appels (utile quand la même table est interrogée puis
 * modifiée dans un même traitement). Les tables non listées tombent sur une
 * chaîne vide `{ data: null, error: null }`.
 */
export function useSupabaseTables(
  fromMock: unknown,
  tables: Record<string, FakeChain | FakeChain[]>,
): void {
  const target = fromMock as FromLike;
  const queues = new Map<string, { items: FakeChain[]; cursor: number }>();
  for (const [table, value] of Object.entries(tables)) {
    queues.set(table, { items: Array.isArray(value) ? value : [value], cursor: 0 });
  }
  const fallback = fakeChain({ data: null, error: null });

  target.mockImplementation((table: string) => {
    const queue = queues.get(table);
    if (!queue) return fallback;
    const chain = queue.items[Math.min(queue.cursor, queue.items.length - 1)];
    queue.cursor += 1;
    return chain;
  });
}

export interface FakeStorageBucket {
  upload: AnyFn;
  getPublicUrl: AnyFn;
  createSignedUrl: AnyFn;
  remove: AnyFn;
}

let storageBucket: FakeStorageBucket | null = null;

/**
 * Forme du module `../config/supabase` une fois mocké :
 *   vi.mock('../config/supabase', async () => {
 *     const helper = await import('../testHelpers/supertestApp');
 *     return helper.createSupabaseMock();
 *   });
 */
export function createSupabaseMock(): Record<string, unknown> {
  storageBucket = {
    upload: vi.fn(async () => ({ data: { path: 'fichier-test' }, error: null })),
    getPublicUrl: vi.fn(() => ({
      data: { publicUrl: 'https://storage.test/images/fichier-test.webp' },
    })),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: 'https://storage.test/signed/fichier-test' },
      error: null,
    })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  };

  return {
    supabasePublic: { from: vi.fn() },
    supabaseAdmin: {
      from: vi.fn(),
      rpc: vi.fn(),
      storage: { from: vi.fn(() => storageBucket) },
    },
    storageBucket,
  };
}

export function supabaseStorage(): FakeStorageBucket {
  if (!storageBucket) {
    throw new Error('createSupabaseMock() doit être appelé avant supabaseStorage()');
  }
  return storageBucket;
}

export function adminToken(payload: { adminId?: string; email?: string } = {}): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET manquant : ajoutez vi.hoisted(() => { process.env.ADMIN_JWT_SECRET = ... })');
  }
  return jwt.sign(
    { adminId: payload.adminId ?? 'admin-1', email: payload.email ?? 'admin@test.ci' },
    secret,
    { expiresIn: '1h' },
  );
}

export const CLERK_TOKEN_PREFIX = 'clerk_';

export function clerkToken(userId: string): string {
  return `${CLERK_TOKEN_PREFIX}${userId}`;
}

export function clerkBearer(userId: string): string {
  return `Bearer ${clerkToken(userId)}`;
}

export function clerkPayload(userId: string): {
  __raw: string;
  iss: string;
  sub: string;
  sid: string;
  nbf: number;
  exp: number;
  iat: number;
  [claim: string]: unknown;
} {
  return {
    __raw: '',
    iss: 'https://clerk.test',
    sub: userId,
    sid: 'session_test',
    nbf: 0,
    exp: 4102444800,
    iat: 0,
  };
}

/**
 * Implémentation par défaut de `verifyToken` : seuls les jetons fabriqués par
 * `clerkToken()` passent, tout le reste est rejeté (permet de faire retomber
 * `requireClerkOrAdminAuth` sur le JWT admin).
 */
export async function defaultVerifyToken(token: string): Promise<ReturnType<typeof clerkPayload>> {
  if (!token.startsWith(CLERK_TOKEN_PREFIX)) {
    throw new Error('Token Clerk invalide');
  }
  return clerkPayload(token.slice(CLERK_TOKEN_PREFIX.length));
}

export interface TestAppOptions {
  /** Middlewares montés avant le routeur (requireClerkAuth, etc.). */
  middlewares?: RequestHandler[];
  /** Reproduit le verify de index.ts qui conserve le rawBody du webhook. */
  captureRawBody?: boolean;
}

export function buildTestApp(
  mountPath: string,
  router: Router,
  options: TestAppOptions = {},
): express.Express {
  const app = express();

  if (options.captureRawBody) {
    app.use(
      express.json({
        limit: '1mb',
        verify: (req, _res, buf) => {
          (req as RawBodyRequest).rawBody = buf.toString('utf8');
        },
      }),
    );
  } else {
    app.use(express.json({ limit: '1mb' }));
  }

  if (options.middlewares?.length) {
    app.use(mountPath, ...options.middlewares);
  }
  app.use(mountPath, router);
  app.use(errorHandler);

  return app;
}
