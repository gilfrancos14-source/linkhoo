import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  daysUntil,
  fetchEventsByMarket,
  formatEventDate,
  groupEventsByCity,
  shiftIsoDate,
  type Event,
} from './events';
import { apiEvents, type EventData } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiEvents: { list: vi.fn() },
}));

const listMock = vi.mocked(apiEvents.list);

function ev(overrides: Partial<Event> & { id: string }): Event {
  return {
    market: 'CI',
    city: 'Abidjan',
    title: 'Titre',
    description: '',
    eventDate: '2030-01-01',
    img: '/images/x.jpg',
    alt: 'alt',
    ...overrides,
  };
}

function toLocalIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

afterEach(() => {
  listMock.mockReset();
});

describe('formatEventDate', () => {
  it('affiche « 12 octobre » en français', () => {
    expect(formatEventDate('2026-10-12')).toBe('12 octobre');
  });

  it('ne décale pas le jour (garde anti UTC-)', () => {
    expect(formatEventDate('2026-01-01')).toBe('1 janvier');
  });
});

describe('shiftIsoDate', () => {
  it('décale d’un jour à cheval sur les mois', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('décale d’un jour à cheval sur les années', () => {
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('gère les années bissextiles', () => {
    expect(shiftIsoDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('reste identique pour 0 jour (pas de décalage UTC)', () => {
    expect(shiftIsoDate('2026-06-15', 0)).toBe('2026-06-15');
  });
});

describe('daysUntil', () => {
  const today = toLocalIso(new Date());

  it('vaut 0 pour aujourd’hui', () => {
    expect(daysUntil(today)).toBe(0);
  });

  it('vaut 1 pour demain et -1 pour hier', () => {
    expect(daysUntil(shiftIsoDate(today, 1))).toBe(1);
    expect(daysUntil(shiftIsoDate(today, -1))).toBe(-1);
  });
});

describe('groupEventsByCity', () => {
  it('regroupe les événements par ville', () => {
    const groups = groupEventsByCity([
      ev({ id: '1', city: 'Abidjan' }),
      ev({ id: '2', city: 'Cotonou', market: 'BJ' }),
      ev({ id: '3', city: 'Abidjan' }),
    ]);
    expect(groups).toHaveLength(2);
    const abidjan = groups.find((g) => g.city === 'Abidjan');
    expect(abidjan?.events.map((e) => e.id)).toEqual(['1', '3']);
  });

  it('couverture = événement à venir le plus proche', () => {
    const today = toLocalIso(new Date());
    const soon = shiftIsoDate(today, 2);
    const later = shiftIsoDate(today, 30);
    const groups = groupEventsByCity([
      ev({ id: 'loin', eventDate: later }),
      ev({ id: 'proche', eventDate: soon }),
      ev({ id: 'futur-marche', city: 'Cotonou', market: 'BJ', eventDate: shiftIsoDate(today, 5) }),
    ]);
    const abidjan = groups.find((g) => g.city === 'Abidjan');
    expect(abidjan?.cover.id).toBe('proche');
    expect(abidjan?.marker).toBe('CI');
  });

  it('couverture = événement le plus récent quand tout est passé', () => {
    const today = toLocalIso(new Date());
    const groups = groupEventsByCity([
      ev({ id: 'vieux', eventDate: shiftIsoDate(today, -30) }),
      ev({ id: 'recent', eventDate: shiftIsoDate(today, -5) }),
    ]);
    expect(groups[0].cover.id).toBe('recent');
  });

  it('trie les villes par événement le plus proche, villes sans avenir en fin', () => {
    const today = toLocalIso(new Date());
    const groups = groupEventsByCity([
      ev({ id: '1', city: 'Passe', eventDate: shiftIsoDate(today, -10) }),
      ev({ id: '2', city: 'Loin', eventDate: shiftIsoDate(today, 40) }),
      ev({ id: '3', city: 'Proche', eventDate: shiftIsoDate(today, 3) }),
    ]);
    expect(groups.map((g) => g.city)).toEqual(['Proche', 'Loin', 'Passe']);
  });

  it('d’égalité de date, ordonne les villes par ordre alphabétique', () => {
    const today = toLocalIso(new Date());
    const same = shiftIsoDate(today, 10);
    const groups = groupEventsByCity([
      ev({ id: '1', city: 'Ziguinchor', eventDate: same }),
      ev({ id: '2', city: 'Abidjan', eventDate: same }),
    ]);
    expect(groups.map((g) => g.city)).toEqual(['Abidjan', 'Ziguinchor']);
  });
});

describe('fetchEventsByMarket', () => {
  it('demande le bon marché, mappe les champs et trie par date', async () => {
    const rows: EventData[] = [
      { id: 'b', market: 'CI', city: 'Abidjan', title: 'B', description: '', event_date: '2030-05-01', img: null, alt: null },
      { id: 'a', market: 'CI', city: 'Abidjan', title: 'A', description: 'd', event_date: '2030-01-01', img: '/i.jpg', alt: 'alt A' },
      { id: 'c', market: 'CI', city: 'Abidjan', title: 'C', description: '', event_date: '2030-05-01', img: null, alt: null },
    ];
    listMock.mockResolvedValue(rows);

    const result = await fetchEventsByMarket('CI');

    expect(listMock).toHaveBeenCalledWith('CI');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(result[0].img).toBe('/i.jpg');
    expect(result[0].alt).toBe('alt A');
    expect(result[1].img).toBe('/images/pexels-artbovich-7214173.jpg');
    expect(result[1].alt).toBe('B');
  });

  it('propage l’erreur de l’API', async () => {
    listMock.mockRejectedValue(new Error('réseau'));
    await expect(fetchEventsByMarket('BJ')).rejects.toThrow('réseau');
  });
});
