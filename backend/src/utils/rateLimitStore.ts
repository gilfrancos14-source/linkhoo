import { MemoryStore, type ClientRateLimitInfo, type IncrementResponse, type Options, type Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { createClient } from 'redis';

/**
 * Store de rate limiting partagé entre instances (P0).
 *
 * - `REDIS_URL` absent → `MemoryStore` : comportement historique, correct
 *   tant qu'une seule instance tourne (dev, tests, petit déploiement).
 * - `REDIS_URL` présent → `rate-limit-redis` : les compteurs survivent aux
 *   redéploiements et restent cohérents si plusieurs instances tournent
 *   (scale-out, blue-green) — sinon chaque instance aurait son propre seau
 *   et la limite réelle serait multipliée par le nombre d'instances.
 *
 * Si Redis devient indisponible, chaque opération retombe silencieusement
 * sur un compteur local : la limite redevient « par instance » au lieu de
 * faire échouer les requêtes (500) — dégradation contrôlée.
 */

let redisClient: RedisClient | null = null;
let redisErrorLogged = false;

/** Client Redis standard (sans modules) : le type exact déduit de createClient. */
function buildClient(url: string) {
  return createClient({
    url,
    socket: {
      // Au-delà de 5 essais, on cesse de recharger (repli mémoire local) ;
      // une erreur se répète donc au lieu de boucler en arrière-plan.
      reconnectStrategy: (retries) =>
        retries >= 5 ? new Error('Redis injoignable') : Math.min(retries * 100, 3000),
    },
  });
}

type RedisClient = ReturnType<typeof buildClient>;

function getRedisClient(): RedisClient | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redisClient) {
    const client = buildClient(url);
    client.on('error', (err: unknown) => {
      if (redisErrorLogged) return;
      redisErrorLogged = true;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[rate-limit] Redis inaccessible (${message}) : repli sur le compteur local.`);
    });
    redisClient = client;
    void client.connect().catch(() => {
      // L'événement « error » ci-dessus a déjà loggé.
    });
  }
  return redisClient;
}

interface LocalHit {
  totalHits: number;
  resetTime: Date;
}

/**
 * Compteur local minimal (une fenêtre glissante par clé) utilisé quand Redis
 * est absent ou momentanément inaccessible.
 */
class LocalCounters {
  windowMs = 60_000;
  private readonly hits = new Map<string, LocalHit>();

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  increment(key: string): ClientRateLimitInfo {
    const now = Date.now();
    const existing = this.hits.get(key);
    if (existing && existing.resetTime.getTime() > now) {
      existing.totalHits += 1;
      return existing;
    }
    if (this.hits.size > 10_000) this.sweep(now);
    const hit: LocalHit = { totalHits: 1, resetTime: new Date(now + this.windowMs) };
    this.hits.set(key, hit);
    return hit;
  }

  decrement(key: string): void {
    const hit = this.hits.get(key);
    if (hit && hit.totalHits > 0) hit.totalHits -= 1;
  }

  get(key: string): ClientRateLimitInfo | undefined {
    const hit = this.hits.get(key);
    if (!hit || hit.resetTime.getTime() <= Date.now()) return undefined;
    return hit;
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }

  resetAll(): void {
    this.hits.clear();
  }

  private sweep(now: number): void {
    for (const [key, hit] of this.hits) {
      if (hit.resetTime.getTime() <= now) this.hits.delete(key);
    }
  }
}

/**
 * Décorateur : tente le store partagé (Redis), retombe sur un compteur
 * local dès qu'une opération échoue. Jamais d'exception propagée vers
 * Express — un rate limit ne doit pas casser le trafic.
 */
class ResilientStore implements Store {
  readonly localKeys = false;
  readonly prefix?: string;
  private readonly local = new LocalCounters();
  private warnedOnce = false;

  constructor(private readonly primary: Store) {
    this.prefix = primary.prefix;
  }

  private async withFallback<T>(run: () => Promise<T> | T, fallback: () => T): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (!this.warnedOnce) {
        this.warnedOnce = true;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[rate-limit] Store partagé indisponible (${message}) : repli sur le compteur local.`);
      }
      return fallback();
    }
  }

  init(options: Options): Promise<void> | void {
    this.local.init(options);
    return this.primary.init?.(options);
  }

  increment(key: string): Promise<IncrementResponse> | IncrementResponse {
    return this.withFallback(
      () => this.primary.increment(key),
      () => this.local.increment(key),
    );
  }

  decrement(key: string): Promise<void> | void {
    return this.withFallback(
      () => this.primary.decrement(key),
      () => this.local.decrement(key),
    );
  }

  get(key: string): Promise<ClientRateLimitInfo | undefined> | ClientRateLimitInfo | undefined {
    return this.withFallback(
      async () => (this.primary.get ? await this.primary.get(key) : undefined),
      () => this.local.get(key),
    );
  }

  resetKey(key: string): Promise<void> | void {
    return this.withFallback(
      () => this.primary.resetKey(key),
      () => this.local.resetKey(key),
    );
  }

  shutdown(): Promise<void> | void {
    try {
      this.primary.shutdown?.();
    } catch {
      // Fermeture best-effort.
    }
    this.local.resetAll();
  }
}

/**
 * Crée un store DÉDIÉ à un limiteur (express-rate-limit refuse de partager
 * une même instance entre deux limiters : ERR_ERL_STORE_REUSE).
 *
 * @param prefix namespace Redis de ce limiteur (ex. 'write', 'admin-login')
 */
export function createRateLimitStore(prefix: string): Store {
  const client = getRedisClient();
  if (!client) return new MemoryStore();

  const redisStore = new RedisStore({
    prefix: `ilehya:ratelimit:${prefix}:`,
    sendCommand: (...args: string[]) =>
      client.sendCommand(args) as unknown as Promise<RedisReply>,
  });
  return new ResilientStore(redisStore);
}
