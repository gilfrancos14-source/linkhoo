import { createClient, type RedisClientType } from 'redis';

/**
 * Leader election pour les tâches planifiées (jobs) en cluster.
 *
 * Plusieurs instances de l'API tournent (cluster sur un seul serveur) : un
 * SEUL processus doit exécuter les jobs périodiques, sinon pawaPay est appelé
 * 4 fois, les notifications partent 4 fois, etc.
 *
 * Mécanisme : verrou Redis `SET key token NX PX ttl`, renouvelé tant qu'on est
 * leader. Les non-leaders RETENTENT périodiquement (reprise automatique si le
 * leader tombe).
 *
 * Modes :
 *  - `REDIS_URL` absent (dev mono-instance) → toujours leader (comportement
 *    historique).
 *  - `CLUSTER_MODE !== 'true'` → Redis indisponible = repli leader (une seule
 *    instance en production non-cluster).
 *  - `CLUSTER_MODE === 'true'` → Redis indisponible = ON NE DEVIENT PAS leader
 *    (mieux vaut aucun job que 4× les jobs). On retentera quand Redis revient.
 */

const LOCK_KEY = 'ilehya:jobs:leader';
const LOCK_TTL_MS = 30_000;
const RENEW_INTERVAL_MS = 10_000;
const RETRY_INTERVAL_MS = 15_000;

let client: RedisClientType | null = null;
let connected = false;

function isCluster(): boolean {
  return process.env.CLUSTER_MODE === 'true';
}

function getClient(): RedisClientType | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!client) {
    client = createClient({ url }) as RedisClientType;
    client.on('error', () => {
      // Les erreurs sont gérées par les try/catch des opérations ci-dessous.
    });
  }
  return client;
}

async function ensureConnected(c: RedisClientType): Promise<boolean> {
  if (connected) {
    // Le client peut avoir été déconnecté ; on vérifie l'état réel.
    if (c.isOpen) return true;
    connected = false;
  }
  try {
    if (!c.isOpen) await c.connect();
    connected = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Tente d'acquérir le rôle de leader.
 * Retourne `true` si verrou pris ou déjà détenu, `false` sinon.
 * En mode non-cluster sans Redis, retourne `true` (repli historique).
 */
export async function tryAcquireLeadership(token: string): Promise<boolean> {
  const c = getClient();
  if (!c) return true; // pas de Redis configuré → mono-instance

  const ok = await ensureConnected(c);
  if (!ok) return !isCluster(); // Redis down : leader seulement si mono-instance

  try {
    const acquired = await c.set(LOCK_KEY, token, { NX: true, PX: LOCK_TTL_MS });
    if (acquired === 'OK') return true;
    const holder = await c.get(LOCK_KEY);
    return holder === token;
  } catch {
    return !isCluster();
  }
}

/** Vrai si `token` est toujours propriétaire du verrou (et le renouvelle). */
export async function renewLeadership(token: string): Promise<boolean> {
  const c = getClient();
  if (!c || !connected) return true; // pas de Redis → on reste leader
  try {
    const holder = await c.get(LOCK_KEY);
    if (holder !== token) return false; // verrou perdu → arrêter les jobs
    await c.pExpire(LOCK_KEY, LOCK_TTL_MS);
    return true;
  } catch {
    // Redis momentanément down : on garde le rôle jusqu'à expiration du verrou.
    return true;
  }
}

/**
 * Démarre l'élection et appelle `onBecomeLeader` / `onLoseLeadership`
 * aux changements de rôle. Retourne une fonction d'arrêt.
 *
 * - Le leader renouvelle le verrou et surveille qu'il ne l'a pas perdu.
 * - Les non-leaders retentent régulièrement (reprise automatique).
 */
export function startLeaderElection(
  token: string,
  hooks: { onBecomeLeader: () => void; onLoseLeadership: () => void },
): () => void {
  let stopped = false;
  let isLeader = false;

  const tick = async () => {
    if (stopped) return;
    try {
      if (isLeader) {
        const stillLeader = await renewLeadership(token);
        if (!stillLeader) {
          isLeader = false;
          hooks.onLoseLeadership();
        }
      } else {
        const acquired = await tryAcquireLeadership(token);
        if (acquired) {
          isLeader = true;
          hooks.onBecomeLeader();
        }
      }
    } catch {
      // Ne jamais laisser le timer mourir : on retentera au prochain tick.
    }
  };

  // Premier essai immédiat, puis surveillance régulière.
  void tick();
  const timer = setInterval(() => void tick(), RETRY_INTERVAL_MS);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
