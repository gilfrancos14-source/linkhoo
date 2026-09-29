import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllRows } from './fetchAll';

interface Page {
  data: unknown;
  error: { message: string } | null;
}

function rows(count: number, offset = 0): Array<{ id: number }> {
  return Array.from({ length: count }, (_, index) => ({ id: offset + index }));
}

/**
 * Construit un `run` simulé qui sert `pages` dans l'ordre et enregistre
 * chaque plage `range(from, to)` demandée par fetchAllRows.
 */
function makeRun(pages: Page[]) {
  let cursor = 0;
  const ranges: Array<{ from: number; to: number }> = [];
  const run = vi.fn((from: number, to: number) => {
    ranges.push({ from, to });
    const page = pages[Math.min(cursor, pages.length - 1)];
    cursor += 1;
    return Promise.resolve(page);
  });
  return { run, ranges };
}

describe('fetchAllRows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renvoie un tableau vide quand la première page est vide', async () => {
    const { run, ranges } = makeRun([{ data: [], error: null }]);

    const result = await fetchAllRows<{ id: number }>(run);

    expect(result).toEqual([]);
    expect(ranges).toEqual([{ from: 0, to: 999 }]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('concatène les pages jusqu’à la dernière page partielle', async () => {
    const { run, ranges } = makeRun([
      { data: rows(1000, 0), error: null },
      { data: rows(30, 1000), error: null },
    ]);

    const result = await fetchAllRows<{ id: number }>(run);

    expect(result).toHaveLength(1030);
    expect(result[0]).toEqual({ id: 0 });
    expect(result[1029]).toEqual({ id: 1029 });
    expect(ranges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('s’arrête après une page vide reçue en milieu de pagination', async () => {
    const { run, ranges } = makeRun([
      { data: rows(1000, 0), error: null },
      { data: [], error: null },
    ]);

    const result = await fetchAllRows(run);

    expect(result).toHaveLength(1000);
    expect(ranges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('traite une page `null` comme la fin de la table', async () => {
    const { run } = makeRun([{ data: null, error: null }]);

    await expect(fetchAllRows(run)).resolves.toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('traite une donnée non-tableau comme une page vide', async () => {
    const { run } = makeRun([{ data: { inattendu: true }, error: null }]);

    await expect(fetchAllRows(run)).resolves.toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('propage l’erreur Supabase retournée par la page', async () => {
    const { run } = makeRun([{ data: null, error: { message: 'connexion refusée' } }]);

    await expect(fetchAllRows(run)).rejects.toEqual({ message: 'connexion refusée' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('propage une promesse rejetée par `run`', async () => {
    const run = vi.fn(() => Promise.reject(new Error('réseau indisponible')));

    await expect(fetchAllRows(run)).rejects.toThrow('réseau indisponible');
  });

  it('borne la première requête quand maxRows est inférieur à la page (1000)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { run, ranges } = makeRun([{ data: rows(5), error: null }]);

    const result = await fetchAllRows(run, 5);

    expect(result).toHaveLength(5);
    expect(ranges).toEqual([{ from: 0, to: 4 }]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('plafond de 5 lignes atteint'));
  });

  it('interrompt la pagination quand le plafond maxRows est atteint', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { run, ranges } = makeRun([
      { data: rows(1000, 0), error: null },
      { data: rows(1000, 1000), error: null },
      { data: rows(500, 2000), error: null },
    ]);

    const result = await fetchAllRows(run, 2500);

    expect(result).toHaveLength(2500);
    expect(ranges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2499 },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('plafond de 2500 lignes atteint'));
  });

  it('n’appelle jamais `run` quand maxRows vaut 0', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { run } = makeRun([{ data: rows(10), error: null }]);

    const result = await fetchAllRows(run, 0);

    expect(result).toEqual([]);
    expect(run).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('plafond de 0 lignes atteint'));
  });

  it('conserve le typage des lignes renvoyées', async () => {
    const { run } = makeRun([{ data: [{ id: 7, nom: 'Cocody' }], error: null }]);

    const result = await fetchAllRows<{ id: number; nom: string }>(run);

    expect(result[0].nom).toBe('Cocody');
    expect(typeof result[0].id).toBe('number');
  });
});
