import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compareOrganic,
  interleaveRooms,
  PER_GERANT_WINDOW,
  PREMIUM_SLOT_RATIO,
  rankWindowRows,
  RANK_MAX_WINDOW,
  type RankableRoom,
} from './rankRooms';

const BASE = Date.parse('2026-01-01T00:00:00.000Z');

interface TestRoom extends RankableRoom {
  id: string;
  gerant_id: string | null;
  created_at: string;
}

/** Index 0 = la chambre la plus récente (l'ordre organique de départ). */
function room(index: number, gerantId: string | null = `g${index}`): TestRoom {
  return {
    id: `r${String(index).padStart(2, '0')}`,
    gerant_id: gerantId,
    created_at: new Date(BASE - index * 60_000).toISOString(),
  };
}

function organicRooms(count: number): TestRoom[] {
  return Array.from({ length: count }, (_, index) => room(index));
}

function organicIndexes(rooms: TestRoom[]): Map<string, number> {
  return new Map(rooms.map((room, index) => [room.id, index]));
}

/** Chambres tirées vers l'avant : rang sorti < rang organique. */
function boosted(ranked: TestRoom[], organic: TestRoom[]): TestRoom[] {
  const indexes = organicIndexes(organic);
  return ranked.filter((room, index) => index < indexes.get(room.id)!);
}

function ids(rooms: TestRoom[]): string[] {
  return rooms.map((room) => room.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('compareOrganic', () => {
  it('trie created_at décroissant', () => {
    const newer = room(0);
    const older = room(1);
    expect([older, newer].sort(compareOrganic)).toEqual([newer, older]);
  });

  it('départage à id croissant', () => {
    const a = { ...room(0), created_at: '2026-01-01T00:00:00.000Z', id: 'a' };
    const b = { ...room(0), created_at: '2026-01-01T00:00:00.000Z', id: 'b' };
    expect([b, a].sort(compareOrganic)).toEqual([a, b]);
  });

  it('traite un created_at manquant comme le plus ancien', () => {
    const dated = room(0);
    const undated = { ...room(1), created_at: null };
    expect([undated, dated].sort(compareOrganic)).toEqual([dated, undated]);
  });
});

describe('rankWindowRows', () => {
  it('lit ratio × la page demandée pour une page de tête', () => {
    expect(rankWindowRows(0, 6)).toBe(6 * PREMIUM_SLOT_RATIO);
    expect(rankWindowRows(0, 24)).toBe(24 * PREMIUM_SLOT_RATIO);
  });

  it('borne la fenêtre à RANK_MAX_WINDOW', () => {
    expect(rankWindowRows(200, 10)).toBe(RANK_MAX_WINDOW);
  });

  it('couvre toujours les lignes de la page demandée', () => {
    for (const offset of [0, 50, 250, 590]) {
      const window = rankWindowRows(offset, 10);
      expect(window).not.toBeNull();
      expect(window!).toBeGreaterThanOrEqual(offset + 10);
    }
  });

  it('refuse une page plus profonde que la borne (repli organique)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(rankWindowRows(RANK_MAX_WINDOW, 6)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('interleaveRooms', () => {
  it('renvoie une liste vide pour une entrée vide', () => {
    expect(interleaveRooms([], new Set(['g1']))).toEqual([]);
  });

  it('conserve l\'ordre organique quand aucun gérant n\'est premium', () => {
    const organic = organicRooms(9);
    const shuffled = [...organic].reverse();

    const ranked = interleaveRooms(shuffled, new Set());

    expect(ids(ranked)).toEqual(ids(organic));
    expect(ids(shuffled)).toEqual(ids([...organic].reverse()));
  });

  it('conserve chaque chambre exactement une fois', () => {
    const organic = Array.from({ length: 30 }, (_, index) =>
      room(index, index % 4 === 0 ? 'gPremium' : `g${index}`),
    );

    const ranked = interleaveRooms(organic, new Set(['gPremium']));

    expect(ids(ranked).sort()).toEqual(ids(organic).sort());
    expect(new Set(ids(ranked)).size).toBe(organic.length);
  });

  it('tire les chambres premium vers l\'avant sur un rang toutes les 3 positions', () => {
    const organic = [
      ...Array.from({ length: 6 }, (_, index) => room(index, 'gOrganic')),
      ...Array.from({ length: 6 }, (_, index) => room(index + 6, `gPremium${index}`)),
    ];
    const premiumIds = new Set(['gPremium0', 'gPremium1', 'gPremium2', 'gPremium3', 'gPremium4', 'gPremium5']);

    const ranked = interleaveRooms(organic, premiumIds);

    expect(ids(ranked)).toEqual(['r06', 'r00', 'r01', 'r07', 'r02', 'r03', 'r08', 'r04', 'r05', 'r09', 'r10', 'r11']);
    const moves = boosted(ranked, organic);
    expect(ids(moves)).toEqual(['r06', 'r07', 'r08']);
    expect(moves.every((room) => ranked.indexOf(room) % PREMIUM_SLOT_RATIO === 0)).toBe(true);
    expect(moves.length).toBeLessThanOrEqual(Math.ceil(organic.length / PREMIUM_SLOT_RATIO));
  });

  it('ne booste jamais un gérant absent du set (premium expiré)', () => {
    const organic = [
      ...Array.from({ length: 6 }, (_, index) => room(index, 'gOrganic')),
      ...Array.from({ length: 6 }, (_, index) => room(index + 6, `gPremium${index}`)),
    ];
    const premiumIds = new Set(['gPremium0', 'gPremium1', 'gPremium2', 'gPremium3', 'gPremium4']);

    const ranked = interleaveRooms(organic, premiumIds);

    expect(ids(boosted(ranked, organic))).not.toContain('r11');
    expect(ids(boosted(ranked, organic))).not.toContain('r00');
  });

  it('ne booste jamais une chambre sans gerant_id', () => {
    const organic = [
      room(0, null),
      room(1, null),
      room(2, 'gPremium'),
      room(3, null),
      room(4, 'gPremium'),
      room(5, null),
    ];

    const ranked = interleaveRooms(organic, new Set(['gPremium']));

    expect(ids(boosted(ranked, organic))).toEqual(['r02']);
  });

  it('n\'apparaît jamais deux fois boosté sur 12 positions glissantes', () => {
    // Un gérant premium (gA) dont les chambres tombent hors des rangs premium :
    // toute apparition de gA sur un rang premium est donc un vrai boost.
    const organic = Array.from({ length: 15 }, (_, index) => room(index, index % 3 === 2 ? 'gA' : 'gOrganic'));

    const ranked = interleaveRooms(organic, new Set(['gA']));

    const moves = boosted(ranked, organic);
    expect(ids(moves)).toEqual(['r02', 'r14']);
    expect(moves.every((room) => room.gerant_id === 'gA')).toBe(true);
    expect(moves.every((room) => ranked.indexOf(room) % PREMIUM_SLOT_RATIO === 0)).toBe(true);

    const positions = moves.map((room) => ranked.indexOf(room));
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]! - positions[index - 1]!).toBeGreaterThanOrEqual(PER_GERANT_WINDOW);
    }
  });

  it('garde l\'ordre relatif des chambres non boostées', () => {
    const organic = Array.from({ length: 15 }, (_, index) => room(index, index % 3 === 2 ? 'gA' : 'gOrganic'));

    const ranked = interleaveRooms(organic, new Set(['gA']));
    const moves = new Set(ids(boosted(ranked, organic)));

    const restRanked = ids(ranked).filter((id) => !moves.has(id));
    const restOrganic = ids(organic).filter((id) => !moves.has(id));
    expect(restRanked).toEqual(restOrganic);
  });

  it('respecte un ratio surchargé', () => {
    const organic = [
      ...Array.from({ length: 6 }, (_, index) => room(index, 'gOrganic')),
      ...Array.from({ length: 6 }, (_, index) => room(index + 6, `gPremium${index}`)),
    ];
    const premiumIds = new Set(['gPremium0', 'gPremium1', 'gPremium2', 'gPremium3', 'gPremium4', 'gPremium5']);

    const ranked = interleaveRooms(organic, premiumIds, { ratio: 4 });

    const moves = boosted(ranked, organic);
    // r08 tombe déjà naturellement sur le rang 8 : rien à tirer vers l'avant.
    expect(ids(moves)).toEqual(['r06', 'r07']);
    expect(moves.every((room) => ranked.indexOf(room) % 4 === 0)).toBe(true);
    expect(moves.length).toBeLessThanOrEqual(Math.ceil(organic.length / 4));
  });

  it('respecte une fenêtre anti-monopole surchargée', () => {
    const organic = Array.from({ length: 15 }, (_, index) => room(index, index % 3 === 2 ? 'gA' : 'gOrganic'));

    const ranked = interleaveRooms(organic, new Set(['gA']), { perGerantWindow: 1 });

    expect(ids(boosted(ranked, organic))).toEqual(['r02', 'r05', 'r08', 'r11', 'r14']);
  });

  it('termine sur une file entièrement premium sans perte', () => {
    const organic = Array.from({ length: 30 }, (_, index) => room(index, `g${index}`));
    const premiumIds = new Set(organic.map((room) => room.gerant_id!));

    const ranked = interleaveRooms(organic, premiumIds);

    expect(ids(ranked).sort()).toEqual(ids(organic).sort());
    // Toutes les chambres sont premium et déjà à leur rang : rien n'est tiré.
    expect(ids(boosted(ranked, organic))).toEqual([]);
  });
});
