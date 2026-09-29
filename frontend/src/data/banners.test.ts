import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBannersBySection } from './banners';
import type { BannerData } from '../lib/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn<(market?: string) => Promise<unknown[]>>(),
}));

vi.mock('../lib/api', () => ({ apiBanners: { list: mocks.list } }));

function apiBanner(overrides: Partial<BannerData> = {}): BannerData {
  return {
    id: 'banner-1',
    section: 'popular',
    img: '/images/banner.jpg',
    alt: 'Bannière populaire',
    link: '/ci/chambres',
    market: 'CI',
    order: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchBannersBySection', () => {
  it('ne garde que la section demandée et trie par order croissant', async () => {
    mocks.list.mockResolvedValue([
      apiBanner({ id: 'p2', section: 'popular', order: 2 }),
      apiBanner({ id: 'e1', section: 'events', order: 1 }),
      apiBanner({ id: 'p1', section: 'popular', order: 1 }),
      apiBanner({ id: 'c1', section: 'categories', order: 3 }),
    ]);

    const banners = await fetchBannersBySection('CI', 'popular');

    expect(banners.map((b) => b.id)).toEqual(['p1', 'p2']);
    expect(banners.every((b) => b.section === 'popular')).toBe(true);
  });

  it('délègue le marché demandé à apiBanners.list', async () => {
    mocks.list.mockResolvedValue([apiBanner({ market: 'BJ' })]);

    const banners = await fetchBannersBySection('BJ', 'popular');

    expect(mocks.list).toHaveBeenCalledWith('BJ');
    expect(banners[0]?.market).toBe('BJ');
  });

  it('mappe tous les champs de la bannière', async () => {
    mocks.list.mockResolvedValue([apiBanner()]);

    const [banner] = await fetchBannersBySection('CI', 'popular');

    expect(banner).toEqual({
      id: 'banner-1',
      section: 'popular',
      img: '/images/banner.jpg',
      alt: 'Bannière populaire',
      link: '/ci/chambres',
      market: 'CI',
      order: 2,
    });
  });

  it('renvoie un tableau vide quand la section est absente', async () => {
    mocks.list.mockResolvedValue([apiBanner({ section: 'promos' })]);

    await expect(fetchBannersBySection('CI', 'events')).resolves.toEqual([]);
  });

  it('renvoie un tableau vide quand l’API ne renvoie rien', async () => {
    mocks.list.mockResolvedValue([]);

    await expect(fetchBannersBySection('CI', 'popular')).resolves.toEqual([]);
  });

  it('propage une erreur de l’API', async () => {
    mocks.list.mockRejectedValue(new Error('Réseau indisponible'));

    await expect(fetchBannersBySection('CI', 'popular')).rejects.toThrow(
      'Réseau indisponible',
    );
  });
});
