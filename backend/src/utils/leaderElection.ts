import { createClient, type RedisClientType } from 'redis';

/**
 * Leader election légère pour les tâches planifiées (jobs).
 *
 * Quand plusieurs instances de l'API tournent (cluster sur un seul serveur),
 * un seul processus doit exécuter les jobs périodiques — sinon l'API appelle
 * pawaPay 4 fois, envoie 4 fois les notifications, etc.
 *
 * Mécanisme : un verrou Redis `SET key token NX PX ttl`. Le leader renouvelle
 * le verrou régulièrement ; les autres instances attendent et retentent. Si
 * Redis est absent (dev / petite installation mono-instance), la fonction
 * retourne `true` : on retombe sur le comportement historique (une instance
 * = un leader), sans casser quoi que ce soit.
 */

const LOCK_KEY = 'ilehya:jobs:leader';
const LOCK_TTL_MS = 30_000;
const RENEW_INTERVAL_MS = 10_000;

let client: RedisClientType | null = null;
let connected = false;

function getClient(): RedisClientType | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!client) {
    client = createClient({ url }) as RedisClientType;
    client.on('error', () => {
      // Le repli est géré par tryAcquire : on logge une seule fois.
    });
  }
  return client;
}

async function ensureConnected(c: RedisClientType): Promise<boolean> {
  if (connected) return true;
  try {
    await c.connect();
    connected = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Tente d'acquérir le rôle de leader.
 * - Sans REDIS_URL → true (mode mono-instance historique).
 * - Avec Redis → true si le verrou a été pris OU appartient déjà à ce token.
 */
export async function tryAcquireLeadership(token: string): Promise<boolean> {
  const c = getClient();
  if (!c) return true;
  if (!(await ensureConnected(c))) return true; // repli mono-instance

  try {
    // Ne pas écraser un verrou détenu par une autre instance.
    const acquired = await c.set(LOCK_KEY, token, { NX: true, PX: LOCK_TTL_MS });
    if (acquired === 'OK') return true;
    const holder = await c.get(LOCK_KEY);
    return holder === token; // déjà leader (renew)
  } catch {
    return true; // Redis en panne → on accepte le rôle (dégradation contrôlée)
  }
}

/** Renouvelle périodiquement le verrou tant que ce token en est le propriétaire. */
export function startLeadershipRenewal(token: string): () => void {
  const c = getClient();
  if (!c) return () => undefined;

  const timer = setInterval(async () => {
    try {
      const holder = await c.get(LOCK_KEY);
      if (holder === token) {
        await c.pExpire(LOCK_KEY, LOCK_TTL_MS);
      }
    } catch {
      // Redis en panne : le verrou expirera et une autre instance reprendra.
    }
  }, RENEW_INTERVAL_MS);
  timer.unref();

  return () => clearInterval(timer);
}
