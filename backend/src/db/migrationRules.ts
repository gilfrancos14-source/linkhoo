import type { MigrationFile } from './migrationRunner';

/**
 * Règles de sûreté sur les fichiers de migration (filet CI + pré-vol).
 *
 * Deux familles :
 * - `staticIssues` : pur texte, sans base — tourne dans les tests (donc la CI)
 *   et dans `npm run migrate:check`. Elle attrape le DROP FUNCTION sans liste
 *   de types, les contraintes sans garde et les DDL destructeurs.
 * - `dbIssues` : confronte les fichiers à l'état réel de la base cible, dans
 *   l'ordre de version — seule façon de voir qu'une colonne déclarée dans un
 *   CREATE TABLE IF NOT EXISTS ne sera pas réinjectée sur une table existante.
 */

export type RuleId =
  | 'drop-function-bare'
  | 'constraint-unguarded'
  | 'destructive-ddl'
  | 'column-add-unguarded'
  | 'index-column-missing'
  | 'unknown-table';

export interface MigrationIssue {
  filename: string;
  rule: RuleId;
  message: string;
}

/** Aperçu de la base cible (lecture seule : information_schema). */
export interface DbSnapshot {
  /** Noms de tables du schéma public. */
  tables: Set<string>;
  /** `table.column`. */
  columns: Set<string>;
}

/**
 * Masque les commentaires et les corps `$$ ... $$` en gardant les sauts de
 * ligne : les numéros de ligne restent exacts, mais l'intérieur d'une fonction
 * (purges, tests) n'est plus lu comme du DDL exécuté au chargement.
 */
function maskIrrelevant(sql: string): string {
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ');
  return sql
    .replace(/--[^\n]*/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\$\$[\s\S]*?\$\$/g, blank);
}

/** Numéro de ligne (1-based) d'un index dans un texte. */
function lineOf(sql: string, index: number): number {
  return sql.slice(0, index).split('\n').length;
}

/** Corps entre parenthèses équilibrées, en ignorant les chaînes entre guillemets. */
function balancedBody(sql: string, openIndex: number): string {
  let depth = 0;
  let inString = false;
  for (let i = openIndex; i < sql.length; i += 1) {
    const ch = sql[i];
    if (inString) {
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(openIndex + 1, i);
    }
  }
  return sql.slice(openIndex + 1);
}

/** Jetons en tête des définitions de colonnes d'un corps `CREATE TABLE`. */
function tableColumns(body: string): string[] {
  const columns: string[] = [];
  for (const fragment of body.split(',')) {
    const line = fragment.trim();
    if (!line) continue;
    if (/^(constraint|check|primary|unique|foreign|like)\b/i.test(line)) continue;
    const name = line.split(/\s+/)[0]?.replace(/^"|"$/g, '');
    if (name && /^[A-Za-z_]\w*$/.test(name)) columns.push(name);
  }
  return columns;
}

const DROP_FUNCTION = /\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*/gi;
const ADD_CONSTRAINT = /\bALTER\s+TABLE\s+(\w+)\s+ADD\s+CONSTRAINT\s+(\w+)/gi;
const ADD_COLUMN = /\bALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
const CREATE_TABLE = /\bCREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(/gi;
const CREATE_INDEX = /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(\w+)\s*\(([^)]*)\)/gi;
const DESTRUCTIVE: [RegExp, string][] = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
  [/\bDELETE\s+FROM\b/i, 'DELETE FROM'],
];

/** Règles de texte — sans base, sans I/O. */
export function staticIssues(files: MigrationFile[]): MigrationIssue[] {
  const issues: MigrationIssue[] = [];

  for (const file of files) {
    const sql = maskIrrelevant(file.sql);

    for (const match of sql.matchAll(DROP_FUNCTION)) {
      const after = sql.slice(match.index + match[0].length);
      const end = after.indexOf(';');
      if (end < 0) continue;
      if (/[()]/.test(after.slice(0, end))) continue; // liste de types : conforme
      issues.push({
        filename: file.filename,
        rule: 'drop-function-bare',
        message:
          `ligne ${lineOf(sql, match.index)} : ${match[0].trim()} sans liste de types — ` +
          'échoue « function name is not unique » quand plusieurs surcharges coexistent',
      });
    }

    for (const match of sql.matchAll(ADD_CONSTRAINT)) {
      const name = match[2];
      const dropIndex = sql.search(
        new RegExp(`DROP\\s+CONSTRAINT\\s+IF\\s+EXISTS\\s+${name}\\b`, 'i'),
      );
      const guardIndex = sql.search(
        new RegExp(`IF\\s+NOT\\s+EXISTS\\s*\\([\\s\\S]{0,240}?conname\\s*=\\s*'${name}'`, 'i'),
      );
      const guarded =
        (dropIndex >= 0 && dropIndex < match.index) || (guardIndex >= 0 && guardIndex < match.index);
      if (guarded) continue;
      issues.push({
        filename: file.filename,
        rule: 'constraint-unguarded',
        message:
          `ligne ${lineOf(sql, match.index)} : ADD CONSTRAINT ${name} sans DROP ... IF EXISTS ` +
          'ni garde DO $$ IF NOT EXISTS — échoue si la contrainte existe déjà',
      });
    }

    for (const [pattern, label] of DESTRUCTIVE) {
      const index = sql.search(pattern);
      if (index < 0) continue;
      issues.push({
        filename: file.filename,
        rule: 'destructive-ddl',
        message: `ligne ${lineOf(sql, index)} : ${label} dans une migration — irréversible sur la production`,
      });
    }
  }

  return issues;
}

type FileEvent =
  | { kind: 'table'; pos: number; table: string; columns: string[] }
  | { kind: 'column'; pos: number; table: string; column: string; guarded: boolean }
  | { kind: 'index'; pos: number; table: string; columns: string[] };

function fileEvents(sql: string): FileEvent[] {
  const events: FileEvent[] = [];

  for (const match of sql.matchAll(CREATE_TABLE)) {
    const open = match.index + match[0].length - 1;
    events.push({
      kind: 'table',
      pos: match.index,
      table: match[2],
      columns: tableColumns(balancedBody(sql, open)),
    });
  }
  for (const match of sql.matchAll(ADD_COLUMN)) {
    events.push({
      kind: 'column',
      pos: match.index,
      table: match[1],
      column: match[3],
      guarded: Boolean(match[2]),
    });
  }
  for (const match of sql.matchAll(CREATE_INDEX)) {
    events.push({
      kind: 'index',
      pos: match.index,
      table: match[1],
      columns: match[2]
        .split(',')
        .map((raw) => raw.trim().split(/\s+/)[0]?.replace(/^"|"$/g, ''))
        .filter((name): name is string => Boolean(name) && !name?.includes('(')),
    });
  }

  return events.sort((a, b) => a.pos - b.pos);
}

/**
 * Règles confrontées à la base cible, fichiers dans l'ordre de version et
 * déclarations dans l'ordre du fichier : l'état examiné est celui qui
 * existera **au moment où chaque instruction s'exécute**, pas l'état final.
 */
export function dbIssues(files: MigrationFile[], snapshot: DbSnapshot): MigrationIssue[] {
  const issues: MigrationIssue[] = [];
  const tables = new Set(snapshot.tables);
  const columns = new Set(snapshot.columns);

  for (const file of files) {
    const sql = maskIrrelevant(file.sql);
    const declaredTables = new Set<string>();

    for (const event of fileEvents(sql)) {
      const line = lineOf(sql, event.pos);

      if (event.kind === 'table') {
        const alreadyExists = tables.has(event.table);
        declaredTables.add(event.table);
        tables.add(event.table);
        // Un CREATE TABLE IF NOT EXISTS sur une table déjà en place ne crée
        // rien : ses colonnes ne « réapparaissent » pas. Seule la base fait foi.
        if (!alreadyExists) {
          for (const column of event.columns) columns.add(`${event.table}.${column}`);
        }
        continue;
      }

      if (event.kind === 'column') {
        const exists = tables.has(event.table);
        if (!event.guarded && exists && !columns.has(`${event.table}.${event.column}`)) {
          issues.push({
            filename: file.filename,
            rule: 'column-add-unguarded',
            message:
              `ligne ${line} : ADD COLUMN ${event.table}.${event.column} sans IF NOT EXISTS ` +
              'alors que la table existe déjà sans cette colonne',
          });
        }
        if (!exists && !declaredTables.has(event.table)) {
          issues.push({
            filename: file.filename,
            rule: 'unknown-table',
            message: `ligne ${line} : ADD COLUMN sur la table ${event.table}, absente de la base et du fichier`,
          });
        }
        columns.add(`${event.table}.${event.column}`);
        continue;
      }

      if (!tables.has(event.table)) {
        issues.push({
          filename: file.filename,
          rule: 'unknown-table',
          message: `ligne ${line} : index sur la table ${event.table}, absente de la base et du fichier`,
        });
        continue;
      }
      const declaredHere = declaredTables.has(event.table);
      for (const name of event.columns) {
        if (columns.has(`${event.table}.${name}`)) continue;
        issues.push({
          filename: file.filename,
          rule: 'index-column-missing',
          message:
            `ligne ${line} : index sur ${event.table}.${name}, colonne absente à ce point de la suite — ` +
            (declaredHere
              ? "déclarée uniquement dans un CREATE TABLE IF NOT EXISTS (non réinjectée sur la table existante) : ajouter l'ADD COLUMN IF NOT EXISTS avant l'index"
              : "ajouter la colonne avant l'index"),
        });
      }
    }
  }

  return issues;
}

/** Aperçu construit à partir des lignes de `information_schema`. */
export function snapshotFromRows(
  columns: { table_name: string; column_name: string }[],
  tables: { table_name: string }[],
): DbSnapshot {
  return {
    tables: new Set(tables.map((row) => row.table_name)),
    columns: new Set(columns.map((row) => `${row.table_name}.${row.column_name}`)),
  };
}
