import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Runner de migrations SQL léger (P1 #6).
 *
 * Les fichiers de `supabase/migrations/` sont nommés `NNN_nom.sql` et
 * appliqués dans l'ordre numérique, chacun dans sa propre transaction, et
 * tracés dans la table `schema_migrations` (une ligne par version appliquée).
 * Seuls les fichiers jamais appliqués sont exécutés.
 *
 * Les fichiers doivent rester idempotents (IF NOT EXISTS / DROP ... IF
 * EXISTS) : une réécriture d'une migration déjà appliquée reste sans effet
 * si on la rejoue à la main, mais le runner ne la rejoue pas de toute façon.
 */

export interface MigrationFile {
  /** Version numérique extraite du nom de fichier (ex. « 008 »). */
  version: string;
  /** Nom lisible après la version (ex. « admin_rpcs »). */
  name: string;
  /** Nom complet du fichier (ex. « 0008_admin_rpcs.sql »). */
  filename: string;
  sql: string;
}

export interface MigrationStatusEntry {
  version: string;
  name: string;
  filename: string;
  applied: boolean;
}

/** Sous-ensemble de `pg.Client` dont le runner a besoin (testable avec un fake). */
export interface MigrationClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const FILE_PATTERN = /^(\d{3,})_([A-Za-z0-9_-]+)\.sql$/;

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * Liste et charge les migrations d'un répertoire, triées par version.
 * Les fichiers hors schéma `NNN_nom.sql` sont ignorés ; deux fichiers avec
 * la même version sont une erreur (ordre d'application ambigu).
 */
export async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  const entries = await readdir(dir);
  const migrations: MigrationFile[] = [];

  for (const filename of entries) {
    const match = FILE_PATTERN.exec(filename);
    if (!match) continue;
    const [, version, name] = match;
    migrations.push({
      version,
      name,
      filename,
      sql: await readFile(path.join(dir, filename), 'utf8'),
    });
  }

  migrations.sort((a, b) => Number(a.version) - Number(b.version));

  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(
        `Version de migration en double : ${migration.version} (${migration.filename})`,
      );
    }
    seen.add(migration.version);
  }

  return migrations;
}

/** Crée la table de suivi si elle n'existe pas encore. */
export async function ensureMigrationsTable(client: MigrationClient): Promise<void> {
  await client.query(CREATE_MIGRATIONS_TABLE);
}

/** Versions déjà appliquées, tracées dans `schema_migrations`. */
export async function appliedVersions(client: MigrationClient): Promise<Set<string>> {
  const { rows } = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  return new Set(rows.map((row) => String(row.version)));
}

/** État de chaque migration (appliquée ou en attente), trié par version. */
export async function migrationStatus(
  client: MigrationClient,
  dir: string,
): Promise<MigrationStatusEntry[]> {
  await ensureMigrationsTable(client);
  const [migrations, applied] = await Promise.all([
    loadMigrations(dir),
    appliedVersions(client),
  ]);
  return migrations.map((migration) => ({
    version: migration.version,
    name: migration.name,
    filename: migration.filename,
    applied: applied.has(migration.version),
  }));
}

export interface RunMigrationsResult {
  applied: string[];
  skipped: string[];
}

export interface RunMigrationsOptions {
  /**
   * Marque les migrations en attente comme appliquées SANS les exécuter :
   * à utiliser la première fois sur une base qui a déjà reçu les fichiers
   * à la main (l'état courant de la base devient la ligne de base).
   */
  baseline?: boolean;
}

/**
 * Applique toutes les migrations en attente dans l'ordre de version.
 * Chaque migration tourne dans sa propre transaction : un échec annule
 * ses effets et stoppe la séquence (les suivantes restent en attente).
 */
export async function runMigrations(
  client: MigrationClient,
  dir: string,
  options: RunMigrationsOptions = {},
): Promise<RunMigrationsResult> {
  await ensureMigrationsTable(client);
  const applied = await appliedVersions(client);
  const migrations = await loadMigrations(dir);
  const pending = migrations.filter((migration) => !applied.has(migration.version));

  const result: RunMigrationsResult = {
    applied: [],
    skipped: migrations
      .filter((migration) => applied.has(migration.version))
      .map((migration) => migration.filename),
  };

  for (const migration of pending) {
    if (options.baseline) {
      await recordMigration(client, migration);
      result.applied.push(migration.filename);
      continue;
    }

    try {
      await client.query('BEGIN');
      // Le fichier complet part en une seule requête : les corps de
      // fonctions $$ ... $$ contiennent des « ; » qu'aucun découpage
      // naïf ne saurait préserver.
      await client.query(migration.sql);
      await recordMigration(client, migration);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${migration.filename} échouée : ${message}`);
    }

    result.applied.push(migration.filename);
  }

  return result;
}

/**
 * Garde d'exécution : au-delà de `--baseline`, rien ne s'applique sans
 * `--yes`. Les lignes renvoyées décrivent la marche à suivre complète
 * (pré-vol, snapshot, exécution) — testées à part.
 */
export function pendingGateLines(pending: MigrationStatusEntry[]): string[] {
  if (pending.length === 0) return [];
  return [
    `${pending.length} migration(s) en attente :`,
    ...pending.map((entry) => `  [ ] ${entry.filename}`),
    '1. npm run migrate:check   (pré-vol lecture seule)',
    '2. Snapshot : Supabase → Database → Backups',
    '3. npm run migrate -- --yes',
  ];
}

async function recordMigration(client: MigrationClient, migration: MigrationFile): Promise<void> {
  await client.query(
    'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
    [migration.version, migration.name],
  );
}
