/**
 * Cache interne avec TTL — SANS dépendance externe (node-cache n'est pas
 * installé dans ce projet et son ajout n'est pas justifié pour un si petit
 * périmètre).
 *
 * Volontairement simple : Map en mémoire, expiration par entrée, nettoyage
 * paresseux au lecture/écriture. Ne stocke AUCUNE donnée sensible en clair —
 * les entrées doivent être des réponses déja publiques ou des résultats de
 * calcul (voir le plan de sécurité : le cache ne doit jamais contenir de PII).
 */

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const MAX_ENTRIES = 500; // garde-fou mémoire

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class SecureCache {
  private store = new Map<string, CacheEntry>();

  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt <= Date.now();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  /**
   * Récupère une valeur du cache (undefined si absente ou expirée).
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /**
   * Stocke une valeur dans le cache avec un TTL (secondes).
   */
  set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL_SECONDS): boolean {
    if (typeof key !== 'string' || key.length === 0) return false;

    this.sweep();

    // Garde-fou : au-delà de MAX_ENTRIES, on purge plutôt que de grossir sans limite.
    if (!this.store.has(key) && this.store.size >= MAX_ENTRIES) {
      this.store.clear();
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
    });
    return true;
  }

  /**
   * Supprime une valeur du cache (1 si présente, 0 sinon).
   */
  del(key: string): number {
    return this.store.delete(key) ? 1 : 0;
  }

  /**
   * Vérifie si une clé existe et est toujours valide.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Liste les clés non expirées.
   */
  keys(): string[] {
    this.sweep();
    return Array.from(this.store.keys());
  }

  /**
   * Vide intégralement le cache.
   */
  flush(): void {
    this.store.clear();
  }

  /**
   * Statistiques (compatible avec l'ancienne interface node-cache).
   */
  getStats(): { keys: number; hits: number; misses: number; ksize: number; vsize: number } {
    return {
      keys: this.store.size,
      hits: 0,
      misses: 0,
      ksize: 0,
      vsize: 0,
    };
  }

  /**
   * Alias historique de `flush`.
   */
  flushAll(): void {
    this.flush();
  }

  /**
   * Libère le cache (l'instance est en mémoire, rien à fermer côté OS).
   */
  close(): void {
    this.flush();
  }
}

// Exportation d'une instance singleton
export const secureCache = new SecureCache();

export default secureCache;
