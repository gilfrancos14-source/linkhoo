import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MigrationClient } from './migrationRunner';

/**
 * Applique le préambule de compatibilité (`supabase/bootstrap.sql`) avant les
 * migrations : schéma `storage`, table `storage.buckets`, rôles Supabase et
 * extension `uuid-ossp`. Idempotent, donc sans effet sur une base Supabase.
 */
export async function applyBootstrap(
  client: MigrationClient,
  bootstrapFile: string = path.resolve(__dirname, '../../supabase/bootstrap.sql'),
): Promise<void> {
  const sql = await readFile(bootstrapFile, 'utf8');
  await client.query(sql);
}
