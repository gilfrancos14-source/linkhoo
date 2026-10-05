import type { MarketCode } from '../contexts/MarketContext';
import { apiRooms, type RoomData, type GerantInfo } from '../lib/api';

export interface Room {
  id: string;
  title: string;
  subtitle: string;
  info: string;
  price: string;
  priceNum: number;
  priceUnit: string;
  img: string;
  alt: string;
  images: string[];
  description: string;
  /** Plus saisi ni affiché : conservé pour les données existantes. */
  capacity?: string;
  category: string;
  market: MarketCode;
  pays: string;
  ville: string;
  quartier: string;
  chambres: number;
  douches: number;
  disponible: boolean;
  dateDispo: string;
  conditions: string;
  isPopular?: boolean;
  promoGroup?: string | null;
  promoStart?: string | null;
  promoEnd?: string | null;
  gerantId?: string;
  gerant?: GerantInfo;
  /** Gérant premium : la carte affiche le badge « Premium ». */
  gerantPremium?: boolean;
}

function mapRoom(d: RoomData): Room {
  return {
    id: d.id,
    title: d.title,
    subtitle: d.subtitle,
    info: d.info,
    price: d.price,
    priceNum: d.price_num,
    priceUnit: d.price_unit,
    img: d.img,
    alt: d.alt,
    images: d.images ?? [],
    description: d.description,
    capacity: d.capacity,
    category: d.category,
    market: d.market as MarketCode,
    pays: d.pays,
    ville: d.ville,
    quartier: d.quartier,
    chambres: d.chambres,
    douches: d.douches,
    disponible: d.disponible,
    dateDispo: d.date_dispo,
    conditions: d.conditions,
    isPopular: d.is_popular ?? false,
    promoGroup: d.promo_group ?? null,
    promoStart: d.promo_start ?? null,
    promoEnd: d.promo_end ?? null,
    gerantId: d.gerant_id,
    gerant: d.gerant,
    gerantPremium: d.gerant_premium,
  };
}

export async function fetchRoomsByMarket(market: MarketCode): Promise<Room[]> {
  const data = await apiRooms.list(market);
  return data.map(mapRoom);
}

export interface RoomListFilters {
  market?: MarketCode;
  ville?: string;
  quartier?: string;
  category?: string;
  chambres?: number;
  disponible?: boolean;
  page?: number;
  limit?: number;
}

export interface RoomListPage {
  items: Room[];
  total: number;
  page: number;
  limit: number;
}

/** Page de chambres filtrée côté serveur (ville, prix, catégorie… inclus). */
export async function fetchRoomsPage(filters: RoomListFilters): Promise<RoomListPage> {
  const data = await apiRooms.listPaged({
    market: filters.market,
    ville: filters.ville,
    quartier: filters.quartier,
    category: filters.category,
    chambres: filters.chambres,
    disponible: filters.disponible,
    page: filters.page,
    limit: filters.limit,
  });
  return {
    items: data.items.map(mapRoom),
    total: data.total,
    page: data.page,
    limit: data.limit,
  };
}

export async function fetchQuartiers(market?: MarketCode): Promise<string[]> {
  return apiRooms.quartiers(market);
}

export async function fetchVilles(market?: MarketCode): Promise<string[]> {
  return apiRooms.villes(market);
}

export async function fetchMyRooms(): Promise<Room[]> {
  const data = await apiRooms.listMine();
  return data.map(mapRoom);
}

export async function fetchAvailableRooms(
  market: MarketCode,
  arrivee: string,
  depart: string,
  ville?: string
): Promise<Room[]> {
  const data = await apiRooms.listAvailable(market, arrivee, depart, ville);
  return data.map(mapRoom);
}

export async function fetchRoomById(id: string): Promise<Room> {
  const data = await apiRooms.get(id);
  return mapRoom(data);
}

export async function createRoom(data: Omit<Room, 'id'>): Promise<Room> {
  const payload: Omit<RoomData, 'id'> = {
    title: data.title,
    subtitle: data.subtitle,
    info: data.info,
    price: data.price,
    price_num: data.priceNum,
    price_unit: data.priceUnit,
    img: data.img,
    alt: data.alt,
    images: data.images,
    description: data.description,
    capacity: data.capacity,
    category: data.category,
    market: data.market,
    pays: data.pays,
    ville: data.ville,
    quartier: data.quartier,
    chambres: data.chambres,
    douches: data.douches,
    disponible: data.disponible,
    date_dispo: data.dateDispo,
    conditions: data.conditions,
    is_popular: data.isPopular ?? false,
    promo_group: data.promoGroup ?? null,
    promo_start: data.promoStart ?? null,
    promo_end: data.promoEnd ?? null,
  };
  const created = await apiRooms.create(payload);
  return mapRoom(created);
}

export async function updateRoom(id: string, updates: Partial<Room>): Promise<void> {
  const payload: Partial<RoomData> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle;
  if (updates.info !== undefined) payload.info = updates.info;
  if (updates.price !== undefined) payload.price = updates.price;
  if (updates.priceNum !== undefined) payload.price_num = updates.priceNum;
  if (updates.priceUnit !== undefined) payload.price_unit = updates.priceUnit;
  if (updates.img !== undefined) payload.img = updates.img;
  if (updates.alt !== undefined) payload.alt = updates.alt;
  if (updates.images !== undefined) payload.images = updates.images;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.capacity !== undefined) payload.capacity = updates.capacity;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.market !== undefined) payload.market = updates.market;
  if (updates.pays !== undefined) payload.pays = updates.pays;
  if (updates.ville !== undefined) payload.ville = updates.ville;
  if (updates.quartier !== undefined) payload.quartier = updates.quartier;
  if (updates.chambres !== undefined) payload.chambres = updates.chambres;
  if (updates.douches !== undefined) payload.douches = updates.douches;
  if (updates.disponible !== undefined) payload.disponible = updates.disponible;
  if (updates.dateDispo !== undefined) payload.date_dispo = updates.dateDispo;
  if (updates.conditions !== undefined) payload.conditions = updates.conditions;
  if (updates.isPopular !== undefined) payload.is_popular = updates.isPopular;
  if (updates.promoGroup !== undefined) payload.promo_group = updates.promoGroup;
  if (updates.promoStart !== undefined) payload.promo_start = updates.promoStart;
  if (updates.promoEnd !== undefined) payload.promo_end = updates.promoEnd;
  await apiRooms.update(id, payload);
}

export async function deleteRoom(id: string): Promise<void> {
  await apiRooms.delete(id);
}

export async function toggleRoom(id: string): Promise<Room> {
  const data = await apiRooms.toggle(id);
  return mapRoom(data);
}

export function getVillesFromRooms(rooms: Room[]): string[] {
  return [...new Set(rooms.map((r) => r.ville))].sort();
}

export function getQuartiersFromRooms(rooms: Room[]): string[] {
  return [...new Set(rooms.map((r) => r.quartier))].sort();
}
