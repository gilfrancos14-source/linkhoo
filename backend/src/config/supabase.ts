import { createClient } from '@supabase/supabase-js';
import { PgDataClient, type PgQueryBuilder, type PgResult } from '../db/postgrest';
import { localStorage } from '../db/storage';

/**
 * Point d'accès unique aux données pour tout le backend.
 *
 * Deux pilotes, choisis par `DB_DRIVER` :
 *
 *  - `postgres` (défaut) : PostgreSQL auto-hébergé, via l'adaptateur de
 *    compatibilité `db/postgrest` (même surface que `supabase-js`) et le
 *    stockage disque (`db/storage`).
 *  - `supabase` : ancien client `supabase-js`, conservé le temps de la
 *    bascule et utilisable comme rollback d'urgence (`DB_DRIVER=supabase`).
 *
 * Le backend gère l'autorisation via Clerk : il n'y a pas de RLS à contourner,
 * les deux exports partagent donc la même connexion propriétaire.
 */

const driver = (process.env.DB_DRIVER ?? 'postgres').toLowerCase();

function createSupabaseClients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required when DB_DRIVER=supabase');
  }

  // La clé anon est invalide : on utilise la service key pour les deux clients.
  // Le backend gère l'autorisation via Clerk, donc le bypass RLS est acceptable.
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  } as const;

  return {
    public: createClient(supabaseUrl, supabaseServiceKey, options),
    admin: createClient(supabaseUrl, supabaseServiceKey, options),
  };
}

function createPostgresClient() {
  const client = new PgDataClient();
  // `storage.from(...)` est appelé tel quel par les routes d'upload.
  return Object.assign(client, { storage: localStorage });
}

/**
 * Surface réellement consommée par le backend. Les deux pilotes la respectent,
 * ce qui permet à `DB_DRIVER` de changer sans toucher une seule route.
 */
export interface DataClient {
  from(table: string): PgQueryBuilder;
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<PgResult<any>>;
  storage: typeof localStorage;
  channel?: (name: string) => unknown;
}

const pgClient = driver === 'supabase' ? null : createPostgresClient();
const supabaseClients = driver === 'supabase' ? createSupabaseClients() : null;

export const supabasePublic: DataClient = (supabaseClients?.public ??
  pgClient) as unknown as DataClient;
export const supabaseAdmin: DataClient = (supabaseClients?.admin ??
  pgClient) as unknown as DataClient;
