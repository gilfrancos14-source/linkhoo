import 'dotenv/config';
import { Client } from 'pg';

/**
 * Audit des contraintes CHECK `NOT VALID` (0006 en crée trois) :
 * une contrainte non validée protège les nouvelles écritures mais laisse
 * passer l'historique — il faut savoir combien de lignes la violent.
 *
 * Lecture seule par défaut. `--fix` valide (`VALIDATE CONSTRAINT`) chaque
 * contrainte à zéro violation ; celles qui restent sont laissées telles quelles.
 *
 * Usage : npm run migrate:audit [-- --fix]
 */

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

interface NotValidConstraint {
  table_name: string;
  constraint_name: string;
  expression: string;
}

async function main(): Promise<void> {
  const fix = process.argv.slice(2).includes('--fix');
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('SUPABASE_DB_URL manquant : renseignez-le dans backend/.env');
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    const { rows } = await client.query<NotValidConstraint>(
      `SELECT cl.relname AS table_name,
              c.conname  AS constraint_name,
              pg_get_expr(c.conbin, c.conrelid) AS expression
         FROM pg_constraint c
         JOIN pg_class cl      ON cl.oid = c.conrelid
         JOIN pg_namespace n   ON n.oid = cl.relnamespace
        WHERE c.contype = 'c'
          AND NOT c.convalidated
          AND n.nspname = 'public'
        ORDER BY cl.relname, c.conname`,
    );

    if (rows.length === 0) {
      console.log('Aucune contrainte CHECK NOT VALID dans le schéma public.');
      return;
    }

    let eligible = 0;
    for (const row of rows) {
      if (!IDENTIFIER.test(row.table_name) || !IDENTIFIER.test(row.constraint_name)) {
        console.error(`  ! ${row.table_name}.${row.constraint_name} : nom d'identifiant inattendu`);
        continue;
      }
      const count = await client.query<{ violations: string }>(
        `SELECT count(*) AS violations FROM "${row.table_name}" WHERE NOT (${row.expression})`,
      );
      const violations = Number(count.rows[0]?.violations ?? '0');
      const status = violations === 0 ? 'validable' : `${violations} ligne(s) en violation`;
      console.log(`  ${row.table_name}.${row.constraint_name} — ${status}`);

      if (violations > 0 || !fix) continue;
      await client.query(
        `ALTER TABLE "${row.table_name}" VALIDATE CONSTRAINT "${row.constraint_name}"`,
      );
      console.log(`    validée ✓`);
      eligible += 1;
    }

    if (!fix) {
      console.log('Contraintes à zéro violation validables avec : npm run migrate:audit -- --fix');
    } else {
      console.log(`${eligible} contrainte(s) validée(s).`);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Audit impossible : ${message}`);
  process.exitCode = 1;
});
