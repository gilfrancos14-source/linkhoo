import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCategoriesByMarket, type Category } from './categories';

const mocks = vi.hoisted(() => ({
  cachedGet: vi.fn<(path: string) => Promise<unknown>>(),
}));

vi.mock('../lib/api', () => ({ cachedGet: mocks.cachedGet }));

const ciCategories: Category[] = [
  { id: 'ci-1', title: 'Chambres moins chères', img: '/images/a.jpg', alt: 'Abordables', market: 'CI' },
  { id: 'ci-2', title: 'Hôtels', img: '/images/b.jpg', alt: "Chambres d'hôtel", market: 'CI' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchCategoriesByMarket', () => {
  it('demande les catégories du marché via cachedGet', async () => {
    mocks.cachedGet.mockResolvedValue(ciCategories);

    await fetchCategoriesByMarket('CI');

    expect(mocks.cachedGet).toHaveBeenCalledWith('/categories?market=CI');
  });

  it('renvoie les catégories de l’API quand elles existent', async () => {
    mocks.cachedGet.mockResolvedValue(ciCategories);

    await expect(fetchCategoriesByMarket('CI')).resolves.toEqual(ciCategories);
  });

  it('retombe sur le jeu CI par défaut quand l’API renvoie un tableau vide', async () => {
    mocks.cachedGet.mockResolvedValue([]);

    const categories = await fetchCategoriesByMarket('CI');

    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.market === 'CI')).toBe(true);
    expect(categories.map((c) => c.title)).toContain('Appartements');
  });

  it('retombe sur le jeu BJ par défaut quand l’API renvoie un tableau vide', async () => {
    mocks.cachedGet.mockResolvedValue([]);

    const categories = await fetchCategoriesByMarket('BJ');

    expect(categories.every((c) => c.market === 'BJ')).toBe(true);
    expect(categories.map((c) => c.title)).toContain('Appartements moins chers');
  });

  it('retombe sur le jeu par défaut quand la requête échoue', async () => {
    mocks.cachedGet.mockRejectedValue(new Error('Réseau indisponible'));

    const categories = await fetchCategoriesByMarket('BJ');

    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.market === 'BJ')).toBe(true);
  });

  it('ne renvoie jamais un jeu vide pour un marché connu', async () => {
    mocks.cachedGet.mockResolvedValue(null);

    await expect(fetchCategoriesByMarket('CI')).resolves.not.toEqual([]);
    await expect(fetchCategoriesByMarket('BJ')).resolves.not.toEqual([]);
  });
});
