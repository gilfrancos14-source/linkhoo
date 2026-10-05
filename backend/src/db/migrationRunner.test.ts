import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appliedVersions,
  ensureMigrationsTable,
  loadMigrations,
  migrationStatus,
  runMigrations,
  type MigrationClient,
} from './migrationRunner';

interface RecordedQuery {
  text: string;
  params?: unknown[];
}

function fakeClient(
  options: { applied?: string[]; failOn?: string } = {},
): { client: MigrationClient; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const client: MigrationClient = {
    query: vi.fn(async (text: string, params?: unknown[]) => {
      queries.push({ text, params });
      if (options.failOn && text.includes(options.failOn)) {
        throw new Error('erreur SQL simulée');
      }
      if (text.includes('SELECT version FROM schema_migrations')) {
        return { rows: (options.applied ?? []).map((version) => ({ version })) };
      }
      return { rows: [] };
    }),
  };
  return { client, queries };
}

describe('migrationRunner', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ilehya-migrations-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('loadMigrations', () => {
    it('charge les fichiers triés par version et ignore les autres', async () => {
      await writeFile(path.join(dir, '002_beta.sql'), 'SELECT 2;');
      await writeFile(path.join(dir, '001_alpha.sql'), 'SELECT 1;');
      await writeFile(path.join(dir, 'lisezmoi.md'), '# pas une migration');
      await writeFile(path.join(dir, 'sans_version.sql'), 'SELECT 3;');

      const migrations = await loadMigrations(dir);

      expect(migrations.map((m) => m.filename)).toEqual(['001_alpha.sql', '002_beta.sql']);
      expect(migrations[0]).toMatchObject({ version: '001', name: 'alpha', sql: 'SELECT 1;' });
    });

    it('refuse deux migrations portant la même version', async () => {
      await writeFile(path.join(dir, '001_alpha.sql'), 'SELECT 1;');
      await writeFile(path.join(dir, '001_bis.sql'), 'SELECT 2;');

      await expect(loadMigrations(dir)).rejects.toThrow('Version de migration en double : 001');
    });
  });

  describe('runMigrations', () => {
    it('applique chaque migration en attente dans sa propre transaction', async () => {
      await writeFile(path.join(dir, '001_alpha.sql'), 'CREATE TABLE a();');
      await writeFile(path.join(dir, '002_beta.sql'), 'CREATE TABLE b();');
      const { client, queries } = fakeClient();

      const result = await runMigrations(client, dir);

      expect(result).toEqual({
        applied: ['001_alpha.sql', '002_beta.sql'],
        skipped: [],
      });

      const sequence = queries.map((q) => q.text);
      expect(sequence[0]).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
      expect(sequence[1]).toBe('SELECT version FROM schema_migrations ORDER BY version');
      expect(sequence.slice(2)).toEqual([
        'BEGIN',
        'CREATE TABLE a();',
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        'COMMIT',
        'BEGIN',
        'CREATE TABLE b();',
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        'COMMIT',
      ]);
      expect(queries.filter((q) => q.text.startsWith('INSERT'))).toEqual([
        expect.objectContaining({ params: ['001', 'alpha'] }),
        expect.objectContaining({ params: ['002', 'beta'] }),
      ]);
    });

    it('ne touche pas aux migrations déjà tracées', async () => {
      await writeFile(path.join(dir, '001_alpha.sql'), 'CREATE TABLE a();');
      await writeFile(path.join(dir, '002_beta.sql'), 'CREATE TABLE b();');
      const { client, queries } = fakeClient({ applied: ['001'] });

      const result = await runMigrations(client, dir);

      expect(result).toEqual({
        applied: ['002_beta.sql'],
        skipped: ['001_alpha.sql'],
      });
      const executed = queries.filter((q) => q.text === 'BEGIN');
      expect(executed).toHaveLength(1);
      expect(queries.some((q) => q.text.includes('CREATE TABLE a()'))).toBe(false);
    });

    it('roule en arrière et signale la migration fautive', async () => {
      await writeFile(path.join(dir, '001_alpha.sql'), 'CREATE TABLE a();');
      await writeFile(path.join(dir, '002_beta.sql'), 'INVALIDE SYNTAX_ERROR_TEST;');
      const { client, queries } = fakeClient({ failOn: 'SYNTAX_ERROR_TEST' });

      await expect(runMigrations(client, dir)).rejects.toThrow(
        'Migration 002_beta.sql échouée : erreur SQL simulée',
      );

      const sequence = queries.map((q) => q.text);
      expect(sequence[sequence.length - 1]).toBe('ROLLBACK');
      // Seul 001 a abouti : un seul COMMIT, celui d'avant l'échec de 002.
      expect(sequence.filter((text) => text === 'COMMIT')).toHaveLength(1);
      expect(sequence.some((q) => q.includes('CREATE TABLE a()'))).toBe(true);
    });

    it('enregistre la baseline sans exécuter les fichiers', async () => {
      await writeFile(path.join(dir, '001_alpha.sql'), 'CREATE TABLE a();');
      const { client, queries } = fakeClient();

      const result = await runMigrations(client, dir, { baseline: true });

      expect(result).toEqual({ applied: ['001_alpha.sql'], skipped: [] });
      expect(queries.some((q) => q.text === 'BEGIN')).toBe(false);
      expect(queries.some((q) => q.text.includes('CREATE TABLE a()'))).toBe(false);
      expect(queries.filter((q) => q.text.startsWith('INSERT'))).toHaveLength(1);
    });
  });

  describe('état des migrations', () => {
    it('ensureMigrationsTable crée la table de suivi', async () => {
      const { client, queries } = fakeClient();
      await ensureMigrationsTable(client);
      expect(queries[0].text).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    });

    it('appliedVersions lit les versions tracées', async () => {
      const { client } = fakeClient({ applied: ['001', '003'] });
      expect([...(await appliedVersions(client))]).toEqual(['001', '003']);
    });

    it('migrationStatus distingue appliquées et en attente', async () => {
      await writeFile(path.join(dir, '001_alpha.sql'), 'SELECT 1;');
      await writeFile(path.join(dir, '002_beta.sql'), 'SELECT 2;');
      const { client } = fakeClient({ applied: ['002'] });

      const status = await migrationStatus(client, dir);

      expect(status).toEqual([
        { version: '001', name: 'alpha', filename: '001_alpha.sql', applied: false },
        { version: '002', name: 'beta', filename: '002_beta.sql', applied: true },
      ]);
    });
  });
});
