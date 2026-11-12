import { query } from './pool';

/**
 * Adaptateur de compatibilité PostgREST → SQL direct.
 *
 * Les routes du backend ont été écrites pour `@supabase/supabase-js` : elles
 * enchaînent `.from('rooms').select('id, title').eq('market', 'CI')
 * .maybeSingle()` et attendent `{ data, error }`. Réécrire 63 appels d'un coup
 * avant la mise en production serait le principal risque du projet : on
 * fournit donc la même surface d'API, mais elle génère du SQL exécuté par `pg`.
 *
 * Périmètre volontairement limité à ce que le code utilise réellement
 * (inventaire du 12/11/2026) :
 *   select / insert / update / upsert / delete
 *   eq neq gt gte lt lte like ilike in is not filters or match
 *   order limit range single maybeSingle
 *   count: 'exact' + head: true
 *   ressources imbriquées (`alias:table(cols)`, `table!inner(cols)`)
 *
 * La couche est temporaire : une fois les routes portées sur des repositories,
 * ce fichier disparaît. Il n'a donc pas vocation à couvrir tout PostgREST.
 */

export interface PgError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export type Row = Record<string, any>;

/**
 * Réponse discriminée sur `error`, comme `supabase-js` : après
 * `if (error) throw error`, TypeScript sait que `data` est non nul.
 */
export type PgResult<T = Row[]> =
  | { data: T; error: null; count?: number | null }
  | { data: null; error: PgError; count?: number | null };

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
  if (!IDENT_RE.test(trimmed)) {
    throw new Error(`Identifiant SQL invalide : « ${name} »`);
  }
  return `"${trimmed}"`;
}

function toPgError(error: unknown): PgError {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return {
      code: typeof err.code === 'string' ? err.code : undefined,
      message: typeof err.message === 'string' ? err.message : String(error),
      details: typeof err.detail === 'string' ? err.detail : null,
      hint: typeof err.hint === 'string' ? err.hint : null,
    };
  }
  return { message: String(error) };
}

/** Contexte de construction : numérote les paramètres `$1`, `$2`… */
class SqlContext {
  readonly params: unknown[] = [];

  param(value: unknown): string {
    this.params.push(value === undefined ? null : value);
    return `$${this.params.length}`;
  }
}

/** Découpe une liste PostgREST en respectant parenthèses et guillemets. */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      else if (char === separator && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

function condition(column: string, op: string, value: unknown, ctx: SqlContext): string {
  const col = quoteIdent(column);

  switch (op) {
    case 'eq':
      return `${col} = ${ctx.param(value)}`;
    case 'neq':
      return `${col} <> ${ctx.param(value)}`;
    case 'gt':
      return `${col} > ${ctx.param(value)}`;
    case 'gte':
      return `${col} >= ${ctx.param(value)}`;
    case 'lt':
      return `${col} < ${ctx.param(value)}`;
    case 'lte':
      return `${col} <= ${ctx.param(value)}`;
    case 'like':
      return `${col} LIKE ${ctx.param(value)}`;
    case 'ilike':
      return `${col} ILIKE ${ctx.param(value)}`;
    case 'is': {
      if (value === null || value === undefined) return `${col} IS NULL`;
      if (value === true || value === 'true') return `${col} IS TRUE`;
      if (value === false || value === 'false') return `${col} IS FALSE`;
      return `${col} IS ${ctx.param(value)}`;
    }
    case 'in': {
      const list = Array.isArray(value) ? value : [value];
      return `${col} = ANY(${ctx.param(list)})`;
    }
    default:
      throw new Error(`Opérateur PostgREST non supporté : « ${op} »`);
  }
}

/**
 * `.or('title.ilike.%a%,ville.ilike.%a%')` : chaque terme est `colonne.op.valeur`.
 * La valeur peut contenir des points (emails, montants) : on ne découpe donc
 * qu'aux deux premiers séparateurs.
 */
function orCondition(raw: string, ctx: SqlContext): string {
  const terms = splitTopLevel(raw, ',').map((term) => {
    const firstDot = term.indexOf('.');
    const secondDot = term.indexOf('.', firstDot + 1);
    if (firstDot < 0 || secondDot < 0) {
      throw new Error(`Terme .or() invalide : « ${term} »`);
    }
    const column = term.slice(0, firstDot);
    const op = term.slice(firstDot + 1, secondDot);
    const value = term.slice(secondDot + 1);
    return condition(column, op, value, ctx);
  });
  return `(${terms.join(' OR ')})`;
}

type Filter =
  | { kind: 'op'; column: string; op: string; value: unknown }
  | { kind: 'not'; column: string; op: string; value: unknown }
  | { kind: 'or'; raw: string };

interface EmbedSpec {
  alias: string;
  table: string;
  inner: boolean;
  selection: string;
}

interface ParsedSelection {
  sql: string;
  wildcard: boolean;
  columns: Set<string>;
  embeds: EmbedSpec[];
}

function parseSelection(raw: string): ParsedSelection {
  const columns = new Set<string>();
  const embeds: EmbedSpec[] = [];
  const fragments: string[] = [];
  let wildcard = false;

  for (const token of splitTopLevel(raw, ',').map((part) => part.trim()).filter(Boolean)) {
    if (token === '*') {
      wildcard = true;
      fragments.push('*');
      continue;
    }

    const openIndex = token.indexOf('(');
    if (openIndex > 0 && token.endsWith(')')) {
      let header = token.slice(0, openIndex);
      const body = token.slice(openIndex + 1, -1);
      const inner = header.includes('!inner');
      header = header.replace('!inner', '').replace('!left', '');
      const [alias, table] = header.includes(':')
        ? (header.split(':') as [string, string])
        : ([header, header] as [string, string]);
      embeds.push({
        alias: alias.trim(),
        table: table.trim(),
        inner,
        selection: body,
      });
      continue;
    }

    const [aliasOrColumn, maybeColumn] = token.split(':') as [string, string | undefined];
    if (maybeColumn) {
      fragments.push(`${quoteIdent(maybeColumn.trim())} AS ${quoteIdent(aliasOrColumn.trim())}`);
      columns.add(aliasOrColumn.trim());
    } else {
      fragments.push(quoteIdent(aliasOrColumn.trim()));
      columns.add(aliasOrColumn.trim());
    }
  }

  return {
    sql: fragments.length > 0 ? fragments.join(', ') : '*',
    wildcard,
    columns,
    embeds,
  };
}

interface ForeignKey {
  fkColumn: string;
  refColumn: string;
}

interface EmbedPlan extends EmbedSpec {
  direction: 'many-to-one' | 'one-to-many';
  parentKey: string;
  childKey: string;
  childSql: string;
  /** La clé de jointure a été ajoutée à la volée : ne pas la renvoyer. */
  addedChildKey: boolean;
}

const foreignKeyCache = new Map<string, ForeignKey | null>();

/**
 * Types des colonnes d'une table, pour sérialiser les valeurs comme le
 * ferait PostgREST.
 *
 * PostgREST envoie du JSON : un tableau JS dans une colonne `jsonb` devient
 * `["stats"]`. `pg`, lui, sérialise un tableau JS en littéral PostgreSQL
 * (`{stats}`), ce que PostgreSQL refuse dans une colonne jsonb
 * (« invalid input syntax for type json »). On regarde donc le type réel de
 * la colonne avant d'écrire.
 */
const columnTypesCache = new Map<string, Map<string, string>>();

async function columnTypes(table: string): Promise<Map<string, string>> {
  const cached = columnTypesCache.get(table);
  if (cached) return cached;

  const { rows } = await query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const types = new Map(rows.map((row) => [row.column_name, row.data_type]));
  columnTypesCache.set(table, types);
  return types;
}

/** Sérialise une valeur selon le type SQL de la colonne cible. */
function serializeValue(
  column: string,
  value: unknown,
  types: Map<string, string>,
): unknown {
  if (value === null || value === undefined) return null;
  const type = types.get(column);
  if (type !== 'json' && type !== 'jsonb') return value;
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function findForeignKey(childTable: string, parentTable: string): Promise<ForeignKey | null> {
  const cacheKey = `${childTable}->${parentTable}`;
  const cached = foreignKeyCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { rows } = await query<{ fk_column: string; ref_column: string }>(
    `SELECT kcu.column_name AS fk_column, ccu.column_name AS ref_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
        AND ccu.table_name = $2
      ORDER BY kcu.ordinal_position
      LIMIT 1`,
    [childTable, parentTable],
  );

  const result = rows[0]
    ? { fkColumn: rows[0].fk_column, refColumn: rows[0].ref_column }
    : null;
  foreignKeyCache.set(cacheKey, result);
  return result;
}

async function resolveEmbed(parentTable: string, spec: EmbedSpec): Promise<EmbedPlan> {
  const childSelection = parseSelection(spec.selection);
  const childSql = childSelection.sql;

  const direct = await findForeignKey(parentTable, spec.table);
  if (direct) {
    const addedChildKey =
      !childSelection.wildcard && !childSelection.columns.has(direct.refColumn);
    return {
      ...spec,
      direction: 'many-to-one',
      parentKey: direct.fkColumn,
      childKey: direct.refColumn,
      childSql: addedChildKey
        ? `${childSql}, ${quoteIdent(direct.refColumn)}`
        : childSql,
      addedChildKey,
    };
  }

  const reverse = await findForeignKey(spec.table, parentTable);
  if (reverse) {
    const addedChildKey = !childSelection.wildcard && !childSelection.columns.has(reverse.fkColumn);
    return {
      ...spec,
      direction: 'one-to-many',
      parentKey: reverse.refColumn,
      childKey: reverse.fkColumn,
      childSql: addedChildKey ? `${childSql}, ${quoteIdent(reverse.fkColumn)}` : childSql,
      addedChildKey,
    };
  }

  throw new Error(
    `Relation introuvable entre « ${parentTable} » et « ${spec.table} » : ` +
      'ajoutez une clé étrangère ou remplacez la ressource imbriquée par un JOIN',
  );
}

export interface SelectOptions {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
}

export class PgQueryBuilder<T = Row[]> implements PromiseLike<PgResult<T>> {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selection: string | null = null;
  private returnsRows = false;
  private payload: Row | Row[] | null = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | null = null;
  private filters: Filter[] = [];
  private orders: string[] = [];
  private limitValue: number | null = null;
  private offsetValue = 0;
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';
  private countRequested = false;
  private head = false;

  constructor(private readonly table: string) {}

  select(columns: string = '*', options: SelectOptions = {}): this {
    this.selection = columns;
    this.returnsRows = true;
    if (options.count) this.countRequested = true;
    if (options.head) this.head = true;
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.action = 'insert';
    this.payload = payload;
    this.upsertOptions = options;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'lte', value });
    return this;
  }

  like(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'like', value });
    return this;
  }

  ilike(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'ilike', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'op', column, op: 'in', value: values });
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op: 'is', value });
    return this;
  }

  not(column: string, op: string, value: unknown): this {
    this.filters.push({ kind: 'not', column, op, value });
    return this;
  }

  filter(column: string, op: string, value: unknown): this {
    this.filters.push({ kind: 'op', column, op, value });
    return this;
  }

  match(criteria: Row): this {
    for (const [column, value] of Object.entries(criteria)) {
      this.filters.push({ kind: 'op', column, op: 'eq', value });
    }
    return this;
  }

  or(raw: string): this {
    this.filters.push({ kind: 'or', raw });
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    const direction = options.ascending === false ? 'DESC' : 'ASC';
    const nulls =
      options.nullsFirst === undefined
        ? ''
        : options.nullsFirst
          ? ' NULLS FIRST'
          : ' NULLS LAST';
    this.orders.push(`${quoteIdent(column)} ${direction}${nulls}`);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  single(): PgQueryBuilder<Row> {
    this.mode = 'single';
    return this as unknown as PgQueryBuilder<Row>;
  }

  maybeSingle(): PgQueryBuilder<Row | null> {
    this.mode = 'maybeSingle';
    return this as unknown as PgQueryBuilder<Row | null>;
  }

  // Le builder doit être `await`-able comme celui de supabase-js.
  // oxlint-disable-next-line unicorn/no-thenable
  then<TResult1 = PgResult<T>, TResult2 = never>(
    onfulfilled?: ((value: PgResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(
      onfulfilled as ((value: PgResult<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected,
    );
  }

  private whereClause(ctx: SqlContext): string {
    if (this.filters.length === 0) return '';
    const conditions = this.filters.map((filter) => {
      if (filter.kind === 'or') return orCondition(filter.raw, ctx);
      if (filter.kind === 'not') {
        return `NOT (${condition(filter.column, filter.op, filter.value, ctx)})`;
      }
      return condition(filter.column, filter.op, filter.value, ctx);
    });
    return ` WHERE ${conditions.join(' AND ')}`;
  }

  private applySingle(rows: Row[], count: number | null): PgResult<Row | Row[] | null> {
    if (this.mode === 'single') {
      if (rows.length !== 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
          count,
        };
      }
      return { data: rows[0], error: null, count };
    }

    if (this.mode === 'maybeSingle') {
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
          count,
        };
      }
      return { data: rows[0] ?? null, error: null, count };
    }

    return { data: rows, error: null, count };
  }

  private async run(): Promise<PgResult<Row[]>> {
    try {
      return (this.action === 'select'
        ? await this.runSelect()
        : await this.runMutation()) as PgResult<Row[]>;
    } catch (error) {
      return { data: null, error: toPgError(error) };
    }
  }

  private async countRows(): Promise<number> {
    const ctx = new SqlContext();
    const where = this.whereClause(ctx);
    const { rows } = await query<{ count: string }>(
      `SELECT count(*)::bigint AS count FROM ${quoteIdent(this.table)}${where}`,
      ctx.params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async runSelect(): Promise<PgResult<any>> {
    const parsed = parseSelection(this.selection ?? '*');
    const plans: EmbedPlan[] = [];
    for (const embed of parsed.embeds) {
      plans.push(await resolveEmbed(this.table, embed));
    }

    // Les clés de jointure doivent figurer dans la requête pour rattacher les
    // ressources imbriquées, même si l'appelant ne les a pas demandées.
    const extraColumns = parsed.wildcard
      ? []
      : plans
          .filter((plan) => plan.direction === 'many-to-one')
          .map((plan) => plan.parentKey)
          .filter((key) => !parsed.columns.has(key));

    const selectList = [parsed.sql, ...extraColumns.map(quoteIdent)].join(', ');

    const count = this.countRequested && !this.head ? await this.countRows() : null;
    if (this.head) {
      const total = await this.countRows();
      return { data: null, error: null, count: total };
    }

    const ctx = new SqlContext();
    const where = this.whereClause(ctx);
    const order = this.orders.length > 0 ? ` ORDER BY ${this.orders.join(', ')}` : '';
    const limit = this.limitValue === null ? '' : ` LIMIT ${Math.max(0, this.limitValue)}`;
    const offset = this.offsetValue > 0 ? ` OFFSET ${this.offsetValue}` : '';

    const { rows } = await query<Row>(
      `SELECT ${selectList} FROM ${quoteIdent(this.table)}${where}${order}${limit}${offset}`,
      ctx.params,
    );

    let result = rows;
    for (const plan of plans) {
      result = await this.attachEmbed(result, plan);
    }

    if (extraColumns.length > 0) {
      for (const row of result) {
        for (const key of extraColumns) delete row[key];
      }
    }

    return this.applySingle(result, count);
  }

  private async attachEmbed(rows: Row[], plan: EmbedPlan): Promise<Row[]> {
    if (rows.length === 0) return rows;

    if (plan.direction === 'many-to-one') {
      const keys = [...new Set(rows.map((row) => row[plan.parentKey]).filter((key) => key != null))];
      const children =
        keys.length === 0
          ? []
          : (
              await query<Row>(
                `SELECT ${plan.childSql} FROM ${quoteIdent(plan.table)} WHERE ${quoteIdent(plan.childKey)} = ANY($1)`,
                [keys],
              )
            ).rows;
      const byKey = new Map(children.map((child) => [String(child[plan.childKey]), child]));
      if (plan.addedChildKey) {
        for (const child of children) delete child[plan.childKey];
      }
      const enriched = rows.map((row) => ({
        ...row,
        [plan.alias]: row[plan.parentKey] == null
          ? null
          : byKey.get(String(row[plan.parentKey])) ?? null,
      }));
      return plan.inner ? enriched.filter((row) => row[plan.alias] != null) : enriched;
    }

    const keys = [...new Set(rows.map((row) => row[plan.parentKey]).filter((key) => key != null))];
    const children =
      keys.length === 0
        ? []
        : (
            await query<Row>(
              `SELECT ${plan.childSql} FROM ${quoteIdent(plan.table)} WHERE ${quoteIdent(plan.childKey)} = ANY($1)`,
              [keys],
            )
          ).rows;
    const grouped = new Map<string, Row[]>();
    for (const child of children) {
      const key = String(child[plan.childKey]);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(child);
      else grouped.set(key, [child]);
    }
    if (plan.addedChildKey) {
      for (const child of children) delete child[plan.childKey];
    }
    return rows.map((row) => ({
      ...row,
      [plan.alias]: row[plan.parentKey] == null
        ? []
        : grouped.get(String(row[plan.parentKey])) ?? [],
    }));
  }

  private async runMutation(): Promise<PgResult<any>> {
    const ctx = new SqlContext();
    const types = await columnTypes(this.table);
    let text: string;

    if (this.action === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const cleaned = rows.map((row) => {
        const entries = Object.entries(row).filter(([, value]) => value !== undefined);
        return Object.fromEntries(entries);
      });
      const columns = [...new Set(cleaned.flatMap((row) => Object.keys(row)))];
      if (columns.length === 0) throw new Error('Insertion sans aucune colonne');

      const values = cleaned
        .map(
          (row) =>
            `(${columns
              .map((column) => ctx.param(serializeValue(column, row[column] ?? null, types)))
              .join(', ')})`,
        )
        .join(', ');

      let conflict = '';
      if (this.upsertOptions) {
        const target = (this.upsertOptions.onConflict ?? 'id')
          .split(',')
          .map((column) => quoteIdent(column.trim()))
          .join(', ');
        if (this.upsertOptions.ignoreDuplicates) {
          conflict = ` ON CONFLICT (${target}) DO NOTHING`;
        } else {
          const updates = columns
            .filter((column) => !target.includes(quoteIdent(column)))
            .map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`)
            .join(', ');
          conflict = updates
            ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates}`
            : ` ON CONFLICT (${target}) DO NOTHING`;
        }
      }

      text =
        `INSERT INTO ${quoteIdent(this.table)} ` +
        `(${columns.map(quoteIdent).join(', ')}) VALUES ${values}${conflict}` +
        this.returningClause();
    } else if (this.action === 'update') {
      const payload = (this.payload ?? {}) as Row;
      const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
      if (entries.length === 0) throw new Error('Mise à jour sans aucune colonne');
      const assignments = entries
        .map(
          ([column, value]) =>
            `${quoteIdent(column)} = ${ctx.param(serializeValue(column, value, types))}`,
        )
        .join(', ');
      const where = this.whereClause(ctx);
      text = `UPDATE ${quoteIdent(this.table)} SET ${assignments}${where}${this.returningClause()}`;
    } else {
      const where = this.whereClause(ctx);
      text = `DELETE FROM ${quoteIdent(this.table)}${where}${this.returningClause()}`;
    }

    const { rows } = await query<Row>(text, ctx.params);
    if (!this.returnsRows) return { data: null, error: null, count: null };
    return this.applySingle(rows, null);
  }

  private returningClause(): string {
    if (!this.returnsRows) return '';
    const parsed = parseSelection(this.selection ?? '*');
    // Les ressources imbriquées ne sont pas gérées en RETURNING : les routes
    // qui en ont besoin relisent la ligne après écriture.
    return ` RETURNING ${parsed.embeds.length === 0 ? parsed.sql : '*'}`;
  }
}

/** Client compatible `supabase-js` adossé à PostgreSQL. */
export class PgDataClient {
  from(table: string): PgQueryBuilder {
    if (!IDENT_RE.test(table)) throw new Error(`Nom de table invalide : « ${table} »`);
    return new PgQueryBuilder(table);
  }

  rpc(name: string, args: Record<string, unknown> = {}): PromiseLike<PgResult> {
    return {
      // oxlint-disable-next-line unicorn/no-thenable
      then: (onfulfilled, onrejected) => callRpc(name, args).then(onfulfilled, onrejected),
    } as PromiseLike<PgResult>;
  }
}

interface RpcInfo {
  returnsSet: boolean;
  /** Type SQL de chaque argument nommé (pour sérialiser comme PostgREST). */
  args: Map<string, string>;
}

const rpcInfoCache = new Map<string, RpcInfo>();

async function rpcInfo(name: string): Promise<RpcInfo> {
  const cached = rpcInfoCache.get(name);
  if (cached) return cached;

  const { rows: meta } = await query<{ proretset: boolean }>(
    `SELECT p.proretset
       FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1
      LIMIT 1`,
    [name],
  );

  const { rows: params } = await query<{ parameter_name: string | null; data_type: string }>(
    `SELECT parameter_name, data_type
       FROM information_schema.parameters
      WHERE specific_schema = 'public' AND specific_name = $1
        AND (parameter_mode IS NULL OR parameter_mode IN ('IN', 'INOUT'))`,
    [name],
  );

  const args = new Map<string, string>();
  for (const row of params) {
    if (row.parameter_name) args.set(row.parameter_name, row.data_type);
  }

  const info = { returnsSet: meta[0]?.proretset ?? true, args };
  rpcInfoCache.set(name, info);
  return info;
}

/**
 * Appelle une fonction SQL comme le ferait PostgREST :
 *  - `RETURNS TABLE` / `SETOF` → tableau de lignes ;
 *  - `RETURNS JSONB`, scalaire → la valeur elle-même ;
 *  - `RETURNS void` → null.
 */
export async function callRpc(
  name: string,
  args: Record<string, unknown> = {},
): Promise<PgResult<any>> {
  try {
    if (!IDENT_RE.test(name)) throw new Error(`Nom de fonction invalide : « ${name} »`);

    const info = await rpcInfo(name);
    const ctx = new SqlContext();
    const argList = Object.entries(args)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        const type = info.args.get(key);
        const serialized =
          type === 'json' || type === 'jsonb'
            ? serializeValue(key, value, new Map([[key, type]]))
            : value;
        return `${quoteIdent(key)} => ${ctx.param(serialized)}`;
      })
      .join(', ');

    const { rows } = await query<Row>(
      `SELECT * FROM ${quoteIdent(name)}(${argList})`,
      ctx.params,
    );

    if (info.returnsSet) return { data: rows, error: null };

    const first = rows[0];
    if (!first) return { data: null, error: null };
    const values = Object.values(first);
    return { data: values.length === 1 ? values[0] : first, error: null };
  } catch (error) {
    return { data: null, error: toPgError(error) };
  }
}
