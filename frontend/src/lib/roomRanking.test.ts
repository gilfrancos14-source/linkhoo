import { describe, expect, it } from 'vitest';
import type { Room } from '../data/rooms';
import { roomTier, sortRoomsByTier } from './roomRanking';

function room(id: string, overrides: Partial<Room> = {}): Room {
  return {
    id,
    title: `Bien ${id}`,
    subtitle: '',
    info: '',
    price: '10 000',
    priceNum: 10000,
    priceUnit: '/ nuit',
    img: '',
    alt: '',
    images: [],
    description: '',
    category: 'Studio',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '',
    conditions: '',
    ...overrides,
  };
}

describe('roomTier', () => {
  it('classe premium, vérifié puis non vérifié', () => {
    expect(roomTier(room('p', { gerantPremium: true, gerantVerified: false }))).toBe(0);
    expect(roomTier(room('v', { gerantPremium: false, gerantVerified: true }))).toBe(1);
    expect(roomTier(room('u', { gerantPremium: false, gerantVerified: false }))).toBe(2);
  });

  it('un premium reste premium même s’il est vérifié', () => {
    expect(roomTier(room('p', { gerantPremium: true, gerantVerified: true }))).toBe(0);
  });

  it('traite les drapeaux absents comme non vérifiés', () => {
    expect(roomTier(room('x'))).toBe(2);
  });
});

describe('sortRoomsByTier', () => {
  it('regroupe par palier en gardant l’ordre d’origine dans chaque groupe', () => {
    const rooms = [
      room('u1', { gerantVerified: false }),
      room('v1', { gerantVerified: true }),
      room('p1', { gerantPremium: true }),
      room('u2', { gerantVerified: false }),
      room('v2', { gerantVerified: true }),
      room('p2', { gerantPremium: true }),
    ];

    expect(sortRoomsByTier(rooms).map((item) => item.id)).toEqual([
      'p1',
      'p2',
      'v1',
      'v2',
      'u1',
      'u2',
    ]);
  });

  it('ne modifie pas le tableau d’origine', () => {
    const rooms = [room('u'), room('p', { gerantPremium: true })];
    const sorted = sortRoomsByTier(rooms);

    expect(sorted.map((item) => item.id)).toEqual(['p', 'u']);
    expect(rooms.map((item) => item.id)).toEqual(['u', 'p']);
  });

  it('renvoie un tableau vide sans chambre', () => {
    expect(sortRoomsByTier([])).toEqual([]);
  });
});
