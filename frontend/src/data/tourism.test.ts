import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_TOURISM, fetchDestinationsByMarket, type DestinationCard } from './tourism';
import { apiTourism, type DestinationData, type TourismPartition } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiTourism: { list: vi.fn() },
}));

const listMock = vi.mocked(apiTourism.list);

function row(overrides: Partial<DestinationData> = {}): DestinationData {
  return {
    id: 'd1',
    market: 'BJ',
    city: 'Ouidah',
    title: 'Ouidah',
    description: 'Plages et histoire.',
    img: '/images/ouidah.jpg',
    alt: "Plage d'Ouidah",
    featured: false,
    ...overrides,
  };
}

afterEach(() => {
  listMock.mockReset();
});

describe('fetchDestinationsByMarket', () => {
  it('demande la partition du marché au serveur et la mappe en cartes', async () => {
    const partition: TourismPartition = {
      big: [row({ id: 'big-1' })],
      small: [row({ id: 'small-1', city: 'Ganvié', title: 'Ganvié', description: 'Marchés flottants.' })],
    };
    listMock.mockResolvedValue(partition);

    const result = await fetchDestinationsByMarket('BJ');

    expect(listMock).toHaveBeenCalledWith('BJ');
    expect(result.big).toHaveLength(1);
    expect(result.small).toHaveLength(1);
    expect(result.big[0]).toMatchObject({
      id: 'big-1',
      title: 'Ouidah',
      city: 'Ouidah',
      text: 'Plages et histoire.',
      img: '/images/ouidah.jpg',
      alt: "Plage d'Ouidah",
      featured: false,
    });
    expect(result.small[0].text).toBe('Marchés flottants.');
  });

  it('comble une image ou un alt absents', async () => {
    listMock.mockResolvedValue({ big: [row({ img: '', alt: null })], small: [] });

    const { big } = await fetchDestinationsByMarket('CI');

    expect(big[0].img).toBe('/images/pexels-artbovich-7214173.jpg');
    expect(big[0].alt).toBe('Ouidah');
  });

  it('remonte l’erreur : c’est le composant qui choisit son repli', async () => {
    listMock.mockRejectedValue(new Error('réseau'));

    await expect(fetchDestinationsByMarket('CI')).rejects.toThrow('réseau');
  });
});

describe('FALLBACK_TOURISM', () => {
  it('couvre les deux marchés avec au moins une destination', () => {
    for (const market of ['BJ', 'CI'] as const) {
      const { big, small } = FALLBACK_TOURISM[market];
      expect(big.length + small.length).toBeGreaterThan(0);
    }
  });

  it('ne propose jamais plus de 2 grosses cartes et aucune destination en double', () => {
    for (const market of ['BJ', 'CI'] as const) {
      const { big, small } = FALLBACK_TOURISM[market];
      expect(big.length).toBeLessThanOrEqual(2);
      const ids = [...big, ...small].map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('reproduit la règle : seules les villes à événement proche sont en grosse carte', () => {
    // BJ : Tori Bossito (J+7) puis Ouidah (J+21) — Cotonou n'a pas de destination.
    expect(FALLBACK_TOURISM.BJ.big.map((d) => d.city)).toEqual(['Tori Bossito', 'Ouidah']);
    // CI : Abidjan (J+15) puis Bouaké (J+25).
    expect(FALLBACK_TOURISM.CI.big.map((d) => d.city)).toEqual(['Abidjan', 'Bouaké']);
  });

  it('garde Grand-Bassam en petite carte (aucun événement dans les 30 jours)', () => {
    expect(FALLBACK_TOURISM.CI.small.map((d) => d.city)).toContain('Grand-Bassam');
    expect(FALLBACK_TOURISM.CI.big.map((d) => d.city)).not.toContain('Grand-Bassam');
  });

  it('est en « mettre en avant » désactivé partout (la règle décide, pas le repli)', () => {
    const all: DestinationCard[] = Object.values(FALLBACK_TOURISM).flatMap(
      ({ big, small }) => [...big, ...small],
    );
    expect(all.every((d) => d.featured === false)).toBe(true);
    expect(all.every((d) => d.img.startsWith('/images/'))).toBe(true);
    expect(all.every((d) => d.text.length > 0)).toBe(true);
  });
});
