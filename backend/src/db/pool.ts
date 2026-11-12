import { Pool, types } from 'pg';

/**
 * Pool PostgreSQL partagé par l'API, les scripts et l'adaptateur de
 * compatibilité (`config/supabase`).
 *
 * Deux réglages importants pour rester iso-comportement avec PostgREST :
 *
 *  - `BIGINT` et `NUMERIC` reviennent en **texte** avec `pg`, alors que
 *    PostgREST les sérialise en nombres JSON. On rétablit le parsing
 *    numérique : sans cela, `"150000" > 1000` est vrai (comparaison de
 *    chaînes) et les montants de paiement deviennent silencieusement faux.
 *  - `TIMESTAMPTZ`/`DATE` reviennent en `Date` JS avec `pg`, alors que
 *    PostgREST renvoie des chaînes ISO. Le code (`.slice(0, 10)`,
 *    `localeCompare`, etc.) attend des chaînes : on conserve le texte brut.
 */

types.setTypeParser(20, (value) => Number.parseInt(value, 10)); // int8
types.setTypeParser(1700, (value) => Number.parseFloat(value)); // numeric

/**
 * PostgreSQL rend `2026-11-12 10:48:09.57352+00`, PostgREST rend
 * `2026-11-12T10:48:09.57352+00:00`. On rétablit la forme ISO exacte : le
 * frontend peut slicing sur la partie date, et `new Date()` reste fiable.
 */
function toIsoTimestamp(value: string): string {
  const iso = value.replace(' ', 'T');
  return iso.replace(/([+-]\d{2})$/, '$1:00');
}

for (const oid of [1184, 1114]) {
  // timestamptz, timestamp : chaînes ISO, comme PostgREST.
  types.setTypeParser(oid, (value) => toIsoTimestamp(value));
}
for (const oid of [1082, 1083]) {
  // date, time : chaînes brutes, comme PostgREST.
  types.setTypeParser(oid, (value) => value);
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL manquant : impossible de se connecter à PostgreSQL');
  }

  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10);
  const statementTimeout = Number.parseInt(
    process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? '20000',
    10,
  );

  pool = new Pool({
    connectionString,
    max: Number.isFinite(max) && max > 0 ? max : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'ilehya-api',
    // Filet de sécurité : une requête qui dérape (verrou, jointure sans
    // index) ne peut pas immobiliser une connexion du pool indéfiniment.
    statement_timeout: Number.isFinite(statementTimeout) ? statementTimeout : 20_000,
    query_timeout: Number.isFinite(statementTimeout) ? statementTimeout + 5_000 : 25_000,
  });

  // Un client inactif peut être coupé (redémarrage de la base, pare-feu) :
  // sans ce handler, l'erreur devient un `unhandledRejection` qui tue le
  // process Node.
  pool.on('error', (error) => {
    console.error('[db] erreur sur un client inactif du pool :', error.message);
  });

  return pool;
}

/** Exécute une requête SQL paramétrée. */
export function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number | null }> {
  return getPool().query<T>(text, params as never[]) as unknown as Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
}

/** Ferme le pool (arrêt propre, scripts CLI). */
export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end().catch(() => undefined);
}

/**
 * Arrêt propre : `pool.end()` attend les requêtes en cours, ce qui évite de
 * perdre une écriture (notification, paiement) lors d'un déploiement.
 */
export async function shutdownPool(timeoutMs = 10_000): Promise<void> {
  await Promise.race([
    closePool(),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
