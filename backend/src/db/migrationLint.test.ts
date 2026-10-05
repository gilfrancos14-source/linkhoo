import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMigrations, type MigrationFile } from './migrationRunner';
import { dbIssues, snapshotFromRows, staticIssues } from './migrationRules';

function file(sql: string, filename = '0001_test.sql'): MigrationFile {
  return { version: '0001', name: 'test', filename, sql };
}

/** Répertoire des migrations réelles, que le test tourne depuis backend/ ou depuis la racine. */
function migrationsDirectory(): string {
  const candidates = [
    path.resolve(process.cwd(), 'supabase/migrations'),
    path.resolve(process.cwd(), 'backend/supabase/migrations'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Répertoire supabase/migrations introuvable');
  return found;
}

function rulesOf(sql: string): string[] {
  return staticIssues([file(sql)]).map((issue) => issue.rule);
}

describe('migrationRules — règles statiques', () => {
  describe('drop-function-bare', () => {
    it('signale un DROP FUNCTION sans liste de types', () => {
      expect(rulesOf('DROP FUNCTION IF EXISTS create_reservation_checked;')).toContain(
        'drop-function-bare',
      );
    });

    it('accepte un DROP FUNCTION typé sur plusieurs lignes', () => {
      const sql = [
        'DROP FUNCTION IF EXISTS create_reservation_checked(',
        '  TEXT, TEXT,',
        '  INTEGER',
        ');',
      ].join('\n');
      expect(rulesOf(sql)).toEqual([]);
    });

    it('ignore ce qui est écrit dans un commentaire', () => {
      expect(rulesOf('-- DROP FUNCTION IF EXISTS foo;')).toEqual([]);
    });
  });

  describe('constraint-unguarded', () => {
    it('signale une contrainte ajoutée sans garde', () => {
      expect(rulesOf('ALTER TABLE rooms ADD CONSTRAINT c CHECK (market IS NOT NULL);')).toContain(
        'constraint-unguarded',
      );
    });

    it('accepte un DROP ... IF EXISTS juste avant', () => {
      const sql = [
        'ALTER TABLE rooms DROP CONSTRAINT IF EXISTS c;',
        'ALTER TABLE rooms ADD CONSTRAINT c CHECK (market IS NOT NULL);',
      ].join('\n');
      expect(rulesOf(sql)).toEqual([]);
    });

    it('accepte la garde DO $$ ... conname ...', () => {
      const sql = [
        'DO $$',
        'BEGIN',
        '  IF NOT EXISTS (',
        "    SELECT 1 FROM pg_constraint WHERE conname = 'c'",
        '  ) THEN',
        '    ALTER TABLE rooms ADD CONSTRAINT c CHECK (market IS NOT NULL);',
        '  END IF;',
        'END $$;',
      ].join('\n');
      expect(rulesOf(sql)).toEqual([]);
    });
  });

  describe('destructive-ddl', () => {
    it('signale DROP TABLE, TRUNCATE et DELETE FROM', () => {
      expect(rulesOf('DROP TABLE tmp_copy;')).toContain('destructive-ddl');
      expect(rulesOf('TRUNCATE rooms;')).toContain('destructive-ddl');
      expect(rulesOf('DELETE FROM notifications WHERE false;')).toContain('destructive-ddl');
    });

    it('accepte une purge écrite dans un corps de fonction', () => {
      const sql = [
        'CREATE FUNCTION purge() RETURNS bigint AS $$',
        'BEGIN',
        '  DELETE FROM notifications WHERE date < now();',
        '  RETURN 1;',
        'END;',
        '$$ LANGUAGE plpgsql;',
      ].join('\n');
      expect(rulesOf(sql)).toEqual([]);
    });
  });
});

describe('migrationRules — règles confrontées à la base', () => {
  const snapshot = snapshotFromRows(
    [
      { table_name: 'reservations', column_name: 'room_id' },
      { table_name: 'reservations', column_name: 'statut' },
    ],
    [{ table_name: 'reservations' }],
  );

  it('signale un index sur une colonne que la table préexistante n\'a pas', () => {
    const sql = [
      'CREATE TABLE IF NOT EXISTS reservations (',
      '  id UUID PRIMARY KEY,',
      '  client_key TEXT',
      ');',
      'CREATE UNIQUE INDEX reservations_client_key_unique ON reservations(client_key);',
    ].join('\n');

    const issues = dbIssues([file(sql)], snapshot);

    expect(issues.map((issue) => issue.rule)).toContain('index-column-missing');
    expect(issues[0]?.message).toContain('CREATE TABLE IF NOT EXISTS');
  });

  it('accepte l\'index quand un ADD COLUMN IF NOT EXISTS précède', () => {
    const sql = [
      'ALTER TABLE reservations ADD COLUMN IF NOT EXISTS client_key TEXT;',
      'CREATE UNIQUE INDEX reservations_client_key_unique ON reservations(client_key);',
    ].join('\n');

    expect(dbIssues([file(sql)], snapshot)).toEqual([]);
  });

  it('accepte l\'index sur une table que ce fichier crée pour de vrai', () => {
    const sql = [
      'CREATE TABLE IF NOT EXISTS nouveaute (id UUID PRIMARY KEY, col TEXT);',
      'CREATE INDEX idx_nouveaute_col ON nouveaute(col);',
    ].join('\n');

    expect(dbIssues([file(sql)], snapshot)).toEqual([]);
  });

  it('signale l\'ADD COLUMN placé APRÈS l\'index (même fichier)', () => {
    const sql = [
      'CREATE UNIQUE INDEX reservations_client_key_unique ON reservations(client_key);',
      'ALTER TABLE reservations ADD COLUMN IF NOT EXISTS client_key TEXT;',
    ].join('\n');

    expect(dbIssues([file(sql)], snapshot).map((issue) => issue.rule)).toEqual([
      'index-column-missing',
    ]);
  });

  it('signale un ADD COLUMN sans IF NOT EXISTS sur une table déjà en place', () => {
    const sql = 'ALTER TABLE reservations ADD COLUMN client_key TEXT;';

    expect(dbIssues([file(sql)], snapshot).map((issue) => issue.rule)).toEqual([
      'column-add-unguarded',
    ]);
  });

  it('accepte l\'état courant (colonnes déjà déclarées par les migrations passées)', () => {
    const sql = 'CREATE INDEX idx ON reservations(room_id);';

    expect(dbIssues([file(sql)], snapshot)).toEqual([]);
  });

  it('signale un index sur une table inconnue', () => {
    const issues = dbIssues([file('CREATE INDEX idx ON fantome(col);')], snapshot);

    expect(issues.map((issue) => issue.rule)).toEqual(['unknown-table']);
  });

  it('enchaîne les fichiers dans l\'ordre de version', () => {
    const first = file('ALTER TABLE reservations ADD COLUMN IF NOT EXISTS client_key TEXT;', '0001_a.sql');
    const second = file('CREATE UNIQUE INDEX k ON reservations(client_key);', '0002_b.sql');

    expect(dbIssues([first, second], snapshot)).toEqual([]);
  });
});

describe('fichiers de migration du dépôt', () => {
  it('passent toutes les règles statiques', async () => {
    const migrations = await loadMigrations(migrationsDirectory());

    expect(migrations.length).toBeGreaterThan(0);
    expect(staticIssues(migrations)).toEqual([]);
  });
});
