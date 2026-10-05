import 'dotenv/config';
import path from 'node:path';
import { Client } from 'pg';
import { migrationStatus, runMigrations } from './migrationRunner';

/**
 * CLI des migrations : `npm run migrate` applique les fichiers en attente.
 *
 * Options :
 *   --status     affiche l'état de chaque migration sans rien appliquer ;
 *   --baseline   marque les migrations en attente comme appliquées sans les
 *                exécuter (première installation sur une base déjà à jour).
 *
 * Connexion via SUPABASE_DB_URL (.env) : chaîne de connexion PostgreSQL du
 * pooler Supabase (port 6543, mode transaction), rôle `postgres`.
 */

const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error(
      'SUPABASE_DB_URL manquant : renseignez la chaîne de connexion PostgreSQL ' +
        'du pooler Supabase dans backend/.env',
    );
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    if (args.includes('--status')) {
      const status = await migrationStatus(client, migrationsDir);
      if (status.length === 0) {
        console.log('Aucun fichier de migration dans supabase/migrations/');
        return;
      }
      for (const entry of status) {
        const mark = entry.applied ? '[x]' : '[ ]';
        console.log(`${mark} ${entry.filename}`);
      }
      return;
    }

    const result = await runMigrations(client, migrationsDir, {
      baseline: args.includes('--baseline'),
    });

    for (const filename of result.skipped) {
      console.log(`  déjà appliquée — ${filename}`);
    }
    for (const filename of result.applied) {
      console.log(`${args.includes('--baseline') ? '  enregistrée' : '  appliquée'} — ${filename}`);
    }
    if (result.applied.length === 0 && result.skipped.length === 0) {
      console.log('Aucun fichier de migration dans supabase/migrations/');
    } else {
      console.log(
        `${result.applied.length} migration(s) traitée(s), ` +
          `${result.skipped.length} déjà en place.`,
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration impossible : ${message}`);
  process.exitCode = 1;
});
