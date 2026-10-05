import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRoom,
  deleteRoom,
  fetchAvailableRooms,
  fetchMyRooms,
  fetchRoomById,
  fetchRoomsByMarket,
  getQuartiersFromRooms,
  getVillesFromRooms,
  toggleRoom,
  updateRoom,
  type Room,
} from './rooms';
import type { RoomData } from '../lib/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn<(market?: string, opts?: { fresh?: boolean }) => Promise<unknown[]>>(),
  listMine: vi.fn<() => Promise<unknown[]>>(),
  listAvailable: vi.fn<(market: string, arrivee: string, depart: string, ville?: string) => Promise<unknown[]>>(),
  get: vi.fn<(id: string) => Promise<unknown>>(),
  create: vi.fn<(data: unknown) => Promise<unknown>>(),
  update: vi.fn<(id: string, data: unknown) => Promise<unknown>>(),
  delete: vi.fn<(id: string) => Promise<void>>(),
  toggle: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock('../lib/api', () => ({ apiRooms: mocks }));

function apiRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: 'room-1',
    title: 'Suite vue mer',
    subtitle: 'Bord de plage',
    info: '2 pers.',
    price: '45 000 FCFA',
    price_num: 45000,
    price_unit: '/ nuit',
    img: '/images/suite.jpg',
    alt: 'Suite vue sur la mer',
    images: ['/images/suite-1.jpg', '/images/suite-2.jpg'],
    description: 'Une suite lumineuse',
    capacity: '2 personnes',
    category: 'Suite',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Grand-Bassam',
    quartier: 'Ficgayo',
    chambres: 1,
    douches: 1,
    disponible: true,
    date_dispo: '2030-06-01',
    conditions: 'Annulation gratuite',
    gerant_id: 'gerant-1',
    is_popular: true,
    promo_group: 'ete',
    promo_start: '2030-06-01',
    promo_end: '2030-08-31',
    ...overrides,
  };
}

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    title: 'Suite vue mer',
    subtitle: 'Bord de plage',
    info: '2 pers.',
    price: '45 000 FCFA',
    priceNum: 45000,
    priceUnit: '/ nuit',
    img: '/images/suite.jpg',
    alt: 'Suite vue sur la mer',
    images: [],
    description: 'Une suite lumineuse',
    capacity: '2 personnes',
    category: 'Suite',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Grand-Bassam',
    quartier: 'Ficgayo',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2030-06-01',
    conditions: 'Annulation gratuite',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getVillesFromRooms / getQuartiersFromRooms', () => {
  it('déduplique et trie les villes', () => {
    const rooms = [
      room({ id: 'a', ville: 'Abidjan' }),
      room({ id: 'b', ville: 'Grand-Bassam' }),
      room({ id: 'c', ville: 'Abidjan' }),
      room({ id: 'd', ville: 'Bouaké' }),
    ];

    expect(getVillesFromRooms(rooms)).toEqual(['Abidjan', 'Bouaké', 'Grand-Bassam']);
  });

  it('déduplique et trie les quartiers', () => {
    const rooms = [
      room({ id: 'a', quartier: 'Cocody' }),
      room({ id: 'b', quartier: 'Plateau' }),
      room({ id: 'c', quartier: 'Cocody' }),
    ];

    expect(getQuartiersFromRooms(rooms)).toEqual(['Cocody', 'Plateau']);
  });

  it('renvoie un tableau vide sans chambre', () => {
    expect(getVillesFromRooms([])).toEqual([]);
    expect(getQuartiersFromRooms([])).toEqual([]);
  });
});

describe('fetchRoomsByMarket', () => {
  it('transforme les chambres renvoyées par l’API', async () => {
    mocks.list.mockResolvedValue([apiRoom()]);

    const rooms = await fetchRoomsByMarket('CI');

    expect(mocks.list).toHaveBeenCalledWith('CI');
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toEqual({
      id: 'room-1',
      title: 'Suite vue mer',
      subtitle: 'Bord de plage',
      info: '2 pers.',
      price: '45 000 FCFA',
      priceNum: 45000,
      priceUnit: '/ nuit',
      img: '/images/suite.jpg',
      alt: 'Suite vue sur la mer',
      images: ['/images/suite-1.jpg', '/images/suite-2.jpg'],
      description: 'Une suite lumineuse',
      capacity: '2 personnes',
      category: 'Suite',
      market: 'CI',
      pays: 'Côte d’Ivoire',
      ville: 'Grand-Bassam',
      quartier: 'Ficgayo',
      chambres: 1,
      douches: 1,
      disponible: true,
      dateDispo: '2030-06-01',
      conditions: 'Annulation gratuite',
      isPopular: true,
      promoGroup: 'ete',
      promoStart: '2030-06-01',
      promoEnd: '2030-08-31',
      gerantId: 'gerant-1',
      gerant: undefined,
    });
  });

  it('transmet gerant_premium vers gerantPremium', async () => {
    mocks.list.mockResolvedValue([apiRoom({ gerant_premium: true }), apiRoom({ id: 'room-2' })]);

    const rooms = await fetchRoomsByMarket('CI');

    expect(rooms[0].gerantPremium).toBe(true);
    expect(rooms[1].gerantPremium).toBeUndefined();
  });

  it("applique les valeurs par défaut (images, promo, populaire)", async () => {
    mocks.list.mockResolvedValue([
      apiRoom({
        market: 'BJ',
        images: undefined,
        is_popular: undefined,
        promo_group: undefined,
        promo_start: undefined,
        promo_end: undefined,
      }),
    ]);

    const [mapped] = await fetchRoomsByMarket('BJ');

    expect(mapped.images).toEqual([]);
    expect(mapped.isPopular).toBe(false);
    expect(mapped.promoGroup).toBeNull();
    expect(mapped.promoStart).toBeNull();
    expect(mapped.promoEnd).toBeNull();
    expect(mapped.market).toBe('BJ');
  });

  it('renvoie un tableau vide quand aucune chambre ne correspond', async () => {
    mocks.list.mockResolvedValue([]);

    await expect(fetchRoomsByMarket('CI')).resolves.toEqual([]);
  });
});

describe('fetchMyRooms / fetchAvailableRooms / fetchRoomById', () => {
  it('fetchMyRooms délègue à apiRooms.listMine', async () => {
    mocks.listMine.mockResolvedValue([apiRoom({ id: 'room-2' })]);

    const rooms = await fetchMyRooms();

    expect(mocks.listMine).toHaveBeenCalledTimes(1);
    expect(rooms[0]?.id).toBe('room-2');
  });

  it('fetchAvailableRooms transmet les dates et la ville optionnelle', async () => {
    mocks.listAvailable.mockResolvedValue([apiRoom()]);

    await fetchAvailableRooms('CI', '2030-06-01', '2030-06-05', 'Grand-Bassam');

    expect(mocks.listAvailable).toHaveBeenCalledWith(
      'CI',
      '2030-06-01',
      '2030-06-05',
      'Grand-Bassam',
    );
  });

  it('fetchAvailableRooms fonctionne sans ville', async () => {
    mocks.listAvailable.mockResolvedValue([]);

    await fetchAvailableRooms('BJ', '2030-06-01', '2030-06-05');

    expect(mocks.listAvailable).toHaveBeenCalledWith('BJ', '2030-06-01', '2030-06-05', undefined);
  });

  it('fetchRoomById transforme une seule chambre', async () => {
    mocks.get.mockResolvedValue(apiRoom({ id: 'room-9' }));

    const fetched = await fetchRoomById('room-9');

    expect(mocks.get).toHaveBeenCalledWith('room-9');
    expect(fetched.id).toBe('room-9');
    expect(fetched.priceNum).toBe(45000);
  });
});

describe('createRoom', () => {
  it('convertit le modèle local en payload snake_case', async () => {
    mocks.create.mockResolvedValue(apiRoom({ id: 'room-new' }));

    const created = await createRoom({
      title: 'Suite vue mer',
      subtitle: 'Bord de plage',
      info: '2 pers.',
      price: '45 000 FCFA',
      priceNum: 45000,
      priceUnit: '/ nuit',
      img: '/images/suite.jpg',
      alt: 'Suite vue sur la mer',
      images: ['/images/suite-1.jpg'],
      description: 'Une suite lumineuse',
      capacity: '2 personnes',
      category: 'Suite',
      market: 'CI',
      pays: 'Côte d’Ivoire',
      ville: 'Grand-Bassam',
      quartier: 'Ficgayo',
      chambres: 1,
      douches: 1,
      disponible: true,
      dateDispo: '2030-06-01',
      conditions: 'Annulation gratuite',
      isPopular: true,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Suite vue mer',
        price_num: 45000,
        price_unit: '/ nuit',
        images: ['/images/suite-1.jpg'],
        date_dispo: '2030-06-01',
        is_popular: true,
        promo_group: null,
        promo_start: null,
        promo_end: null,
      }),
    );
    expect(created.id).toBe('room-new');
    expect(created.isPopular).toBe(true);
  });
});

describe('updateRoom', () => {
  it("n'envoie que les champs présents dans les mises à jour", async () => {
    mocks.update.mockResolvedValue(undefined);

    await updateRoom('room-1', { title: 'Nouveau titre', priceNum: 50000 });

    expect(mocks.update).toHaveBeenCalledWith('room-1', {
      title: 'Nouveau titre',
      price_num: 50000,
    });
  });

  it('convertit les champs camelCase en snake_case', async () => {
    mocks.update.mockResolvedValue(undefined);

    await updateRoom('room-1', {
      ville: 'Abidjan',
      quartier: 'Cocody',
      dateDispo: '2030-09-01',
      isPopular: false,
      promoGroup: null,
      promoStart: null,
    });

    expect(mocks.update).toHaveBeenCalledWith('room-1', {
      ville: 'Abidjan',
      quartier: 'Cocody',
      date_dispo: '2030-09-01',
      is_popular: false,
      promo_group: null,
      promo_start: null,
    });
  });

  it("n'envoie rien quand la mise à jour est vide", async () => {
    mocks.update.mockResolvedValue(undefined);

    await updateRoom('room-1', {});

    expect(mocks.update).toHaveBeenCalledWith('room-1', {});
  });
});

describe('deleteRoom / toggleRoom', () => {
  it('deleteRoom délègue l’identifiant', async () => {
    mocks.delete.mockResolvedValue(undefined);

    await deleteRoom('room-5');

    expect(mocks.delete).toHaveBeenCalledWith('room-5');
  });

  it('toggleRoom transforme la chambre retournée par l’API', async () => {
    mocks.toggle.mockResolvedValue(apiRoom({ id: 'room-5', disponible: false }));

    const toggled = await toggleRoom('room-5');

    expect(mocks.toggle).toHaveBeenCalledWith('room-5');
    expect(toggled.disponible).toBe(false);
  });
});
