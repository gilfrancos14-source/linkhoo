/**
 * PostgREST (et donc Supabase) ne renvoie au plus que `db-max-rows` lignes
 * par réponse — 1000 par défaut. Une requête sans pagination perd donc les
 * lignes au-delà de ce seuil, silencieusement.
 *
 * Cette helper lit la table par tranches et concatène le résultat, ce qui
 * préserve la forme de la réponse (un simple tableau) tout en supprimant la
 * troncature.
 */

const PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 10000;

interface PageResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * @param run construit la requête puis applique `.range(from, to)` :
 *   `(from, to) => supabaseAdmin.from('x').select('*').order(...).range(from, to)`
 * @param maxRows plafond de sécurité (défaut 10 000 lignes)
 */
export async function fetchAllRows<T>(
  run: (from: number, to: number) => PromiseLike<PageResult>,
  maxRows: number = DEFAULT_MAX_ROWS,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (from < maxRows) {
    const to = Math.min(from + PAGE_SIZE, maxRows) - 1;
    const { data, error } = await run(from, to);
    if (error) throw error;

    const page = (Array.isArray(data) ? data : []) as T[];
    all.push(...page);

    // Page incomplète = fin de table atteinte.
    if (page.length < to - from + 1) return all;
    from += page.length;
  }

  console.warn(`[fetchAllRows] plafond de ${maxRows} lignes atteint : résultat tronqué.`);
  return all;
}
