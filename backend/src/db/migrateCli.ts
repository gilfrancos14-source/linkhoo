import 'dotenv/config';
import path from 'node:path';
import { Client } from 'pg';
import { loadMigrations, migrationStatus, pendingGateLines, runMigrations } from './migrationRunner';
import { dbIssues, snapshotFromRows, staticIssues, type MigrationIssue } from './migrationRules';

/**
 * CLI des migrations : `npm run migrate` applique les fichiers en attente.
 *
 * Options :
 *   --status     affiche l'état de chaque migration sans rien appliquer ;
 *   --check      pré-vol lecture seule : lit les fichiers + la base cible et
 *                échoue (code 1) s'il y a un blocage — à lancer avant toute
 *                exécution sur la production ;
 *   --baseline   marque les migrations en attente comme appliquées sans les
 *                exécuter (première installation sur une base déjà à jour) ;
 *   --yes        exécution explicite : sans lui, une migration en attente
 *                n'est pas appliquée (rappel du snapshot à prendre d'abord).
 *
 * Connexion via SUPABASE_DB_URL (.env) : chaîne de connexion PostgreSQL du
 * pooler Supabase (port 6543, mode transaction), rôle `postgres`.
 */

const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

async function readSnapshot(client: Client) {
  const [tables, columns] = await Promise.all([
    client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    ),
    client.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    ),
  ]);
  return snapshotFromRows(columns.rows, tables.rows);
}

function report(issues: MigrationIssue[], label: string): boolean {
  if (issues.length === 0) {
    console.log(`${label} : aucun problème.`);
    return true;
  }
  console.error(`${label} : ${issues.length} problème(s)`);
  for (const issue of issues) {
    console.error(`  ${issue.filename} [${issue.rule}] ${issue.message}`);
  }
  return false;
}

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

    if (args.includes('--check')) {
      const migrations = await loadMigrations(migrationsDir);
      const snapshot = await readSnapshot(client);
      const staticOk = report(staticIssues(migrations), 'Règles de texte');
      const dbOk = report(dbIssues(migrations, snapshot), 'Confrontation à la base');
      const status = await migrationStatus(client, migrationsDir);
      const pending = status.filter((entry) => !entry.applied);
      const names = pending.length > 0 ? pending.map((entry) => entry.filename).join(', ') : 'aucun';
      console.log(`${migrations.length} fichier(s), ${pending.length} en attente : ${names}`);
      process.exitCode = staticOk && dbOk ? 0 : 1;
      return;
    }

    const baseline = args.includes('--baseline');
    if (!baseline && !args.includes('--yes')) {
      const status = await migrationStatus(client, migrationsDir);
      const gate = pendingGateLines(status.filter((entry) => !entry.applied));
      if (gate.length > 0) {
        for (const line of gate) console.error(line);
        process.exitCode = 1;
        return;
      }
    }

    const result = await runMigrations(client, migrationsDir, { baseline });

    for (const filename of result.skipped) {
      console.log(`  déjà appliquée — ${filename}`);
    }
    for (const filename of result.applied) {
      console.log(`${baseline ? '  enregistrée' : '  appliquée'} — ${filename}`);
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
