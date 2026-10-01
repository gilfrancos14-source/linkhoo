import { describe, expect, it } from 'vitest';
import {
  BIG_CARD_COUNT,
  UPCOMING_WINDOW_DAYS,
  normalizeCity,
  partitionDestinations,
  upcomingEventCities,
  upcomingWindow,
} from './tourism';

const TODAY = '2026-10-01';

type Row = { id: string; city: string; featured: boolean; created_at?: string | null };

function destination(overrides: Partial<Row> = {}): Row {
  return {
    id: 'd1',
    city: 'Abidjan',
    featured: false,
    created_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('normalizeCity', () => {
  it('met la ville sur la même clé des deux côtés (événements ↔ destinations)', () => {
    expect(normalizeCity('  Abidjan ')).toBe('abidjan');
    expect(normalizeCity('Bouaké')).toBe('bouake');
    expect(normalizeCity('TORI BOSSITO')).toBe('toribossito');
    expect(normalizeCity('Tori-Bossito')).toBe(normalizeCity('tori bossito'));
  });
});

describe('upcomingWindow', () => {
  it('couvre aujourd’hui + UPCOMING_WINDOW_DAYS', () => {
    expect(upcomingWindow(TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(UPCOMING_WINDOW_DAYS).toBe(30);
  });

  it('franchit la fin de mois et la fin d’année', () => {
    expect(upcomingWindow('2026-11-25').to).toBe('2026-12-25');
    expect(upcomingWindow('2026-12-20').to).toBe('2027-01-19');
  });
});

describe('upcomingEventCities', () => {
  it('garde les événements de la fenêtre et ignore les autres', () => {
    const map = upcomingEventCities(
      [
        { city: 'Ouidah', event_date: '2026-10-07' }, // J+6, dedans
        { city: 'Cotonou', event_date: '2026-10-01' }, // aujourd’hui, dedans
        { city: 'Parakou', event_date: '2026-11-15' }, // J+45, dehors
        { city: 'Lomé', event_date: '2026-09-30' }, // hier, dehors
      ],
      TODAY,
    );
    expect([...map.keys()]).toEqual(['ouidah', 'cotonou']);
  });

  it('garde la limite haute exactement à J+30', () => {
    const map = upcomingEventCities(
      [
        { city: 'Abidjan', event_date: '2026-10-31' },
        { city: 'Bouaké', event_date: '2026-11-01' },
      ],
      TODAY,
    );
    expect(map.get('abidjan')).toBe('2026-10-31');
    expect(map.has('bouake')).toBe(false);
  });

  it('conserve le prochain événement d’une ville et normalise la clé', () => {
    const map = upcomingEventCities(
      [
        { city: ' Abidjan ', event_date: '2026-10-20' },
        { city: 'abidjan', event_date: '2026-10-05' },
        { city: 'ABIDJAN', event_date: '2026-10-12' },
      ],
      TODAY,
    );
    expect([...map.keys()]).toEqual(['abidjan']);
    expect(map.get('abidjan')).toBe('2026-10-05');
  });
});

describe('partitionDestinations', () => {
  it('met en grosse carte une destination dont la ville a un événement proche', () => {
    const { big, small } = partitionDestinations(
      [destination({ id: 'a', city: 'Abidjan' })],
      upcomingEventCities([{ city: 'Abidjan', event_date: '2026-10-15' }], TODAY),
    );
    expect(big.map((d) => d.id)).toEqual(['a']);
    expect(small).toEqual([]);
  });

  it('laisse en petite carte une ville sans événement dans la fenêtre', () => {
    const { big, small } = partitionDestinations(
      [destination({ id: 'a', city: 'Korhogo' })],
      upcomingEventCities([{ city: 'Abidjan', event_date: '2026-10-15' }], TODAY),
    );
    expect(big).toEqual([]);
    expect(small.map((d) => d.id)).toEqual(['a']);
  });

  it('featured force la grosse carte même sans événement (bypass admin)', () => {
    const { big, small } = partitionDestinations([destination({ id: 'a', city: 'Korhogo', featured: true })], new Map());
    expect(big.map((d) => d.id)).toEqual(['a']);
    expect(small).toEqual([]);
  });

  it('ne fabrique jamais de carte : 1 éligible = 1 grosse carte', () => {
    const upcoming = upcomingEventCities([{ city: 'Abidjan', event_date: '2026-10-15' }], TODAY);
    const { big, small } = partitionDestinations(
      [
        destination({ id: 'a', city: 'Abidjan' }),
        destination({ id: 'b', city: 'Bouaké' }),
        destination({ id: 'c', city: 'Yamoussoukro' }),
      ],
      upcoming,
    );
    expect(big).toHaveLength(1);
    expect(small).toHaveLength(2);
  });

  it('renvoie 0 grosse carte si aucune destination n’est éligible', () => {
    const { big, small } = partitionDestinations(
      [destination({ id: 'a' }), destination({ id: 'b' })],
      new Map(),
    );
    expect(big).toEqual([]);
    expect(small.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('pousse en petite carte l’éligible en surnombre (au-delà de 2)', () => {
    const upcoming = upcomingEventCities(
      [
        { city: 'Abidjan', event_date: '2026-10-05' },
        { city: 'Bouaké', event_date: '2026-10-10' },
        { city: 'Yamoussoukro', event_date: '2026-10-15' },
      ],
      TODAY,
    );
    const { big, small } = partitionDestinations(
      [
        destination({ id: 'a', city: 'Abidjan' }),
        destination({ id: 'b', city: 'Bouaké' }),
        destination({ id: 'c', city: 'Yamoussoukro' }),
      ],
      upcoming,
    );
    expect(big.map((d) => d.id)).toEqual(['a', 'b']);
    expect(small.map((d) => d.id)).toEqual(['c']);
  });

  it('trie : featured d’abord, puis événement le plus proche', () => {
    const upcoming = upcomingEventCities(
      [
        { city: 'Abidjan', event_date: '2026-10-25' },
        { city: 'Bouaké', event_date: '2026-10-03' },
        { city: 'Korhogo', event_date: '2026-10-12' },
      ],
      TODAY,
    );
    const { big, small } = partitionDestinations(
      [
        destination({ id: 'late', city: 'Abidjan' }),
        destination({ id: 'soon', city: 'Bouaké' }),
        destination({ id: 'med', city: 'Korhogo' }),
        destination({ id: 'boosted', city: 'San-Pédro', featured: true }),
      ],
      upcoming,
    );
    expect(big.map((d) => d.id)).toEqual(['boosted', 'soon']);
    expect(small.map((d) => d.id)).toEqual(['med', 'late']);
  });

  it('est déterministe : created_at puis id pour départager', () => {
    const upcoming = upcomingEventCities(
      [
        { city: 'Abidjan', event_date: '2026-10-05' },
        { city: 'Bouaké', event_date: '2026-10-05' },
      ],
      TODAY,
    );
    const rows = [
      destination({ id: 'z', city: 'Abidjan', created_at: '2026-09-01T00:00:00Z' }),
      destination({ id: 'y', city: 'Bouaké', created_at: '2026-09-01T00:00:00Z' }),
      destination({ id: 'x', city: 'Bouaké', created_at: '2026-08-01T00:00:00Z' }),
    ];
    const first = partitionDestinations(rows, upcoming);
    const second = partitionDestinations([...rows].reverse(), upcoming);
    expect(first.big.map((d) => d.id)).toEqual(second.big.map((d) => d.id));
    expect(first.small.map((d) => d.id)).toEqual(second.small.map((d) => d.id));
    expect(first.big.map((d) => d.id)).toEqual(['x', 'y']);
    expect(first.small.map((d) => d.id)).toEqual(['z']);
  });

  it('respecte BIG_CARD_COUNT et ne duplique aucune destination', () => {
    expect(BIG_CARD_COUNT).toBe(2);
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => destination({ id, city: 'Abidjan', featured: true }));
    const { big, small } = partitionDestinations(rows, new Map());
    expect(big).toHaveLength(BIG_CARD_COUNT);
    const ids = [...big, ...small].map((d) => d.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('ne modifie pas le tableau d’entrée', () => {
    const rows = [destination({ id: 'b' }), destination({ id: 'a' })];
    partitionDestinations(rows, new Map());
    expect(rows.map((d) => d.id)).toEqual(['b', 'a']);
  });
});
