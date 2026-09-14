import type { MarketCode } from '../contexts/MarketContext';
import { apiRooms, type RoomData } from '../lib/api';

export type { MarketCode };

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
  capacity: string;
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
  };
}

export async function fetchRoomsByMarket(market: MarketCode): Promise<Room[]> {
  try {
    const data = await apiRooms.list(market);
    return data.map(mapRoom);
  } catch {
    return getLocalRooms().filter((r) => r.market === market);
  }
}

export async function fetchRoomById(id: string): Promise<Room | null> {
  try {
    const data = await apiRooms.get(id);
    return mapRoom(data);
  } catch {
    const all = getLocalRooms();
    return all.find((r) => r.id === id) ?? null;
  }
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
  if (updates.disponible !== undefined) payload.disponible = updates.disponible;
  if (updates.dateDispo !== undefined) payload.date_dispo = updates.dateDispo;
  if (updates.conditions !== undefined) payload.conditions = updates.conditions;
  await apiRooms.update(id, payload);
}

export async function deleteRoom(id: string): Promise<void> {
  await apiRooms.delete(id);
}

export async function toggleRoom(id: string): Promise<Room> {
  const data = await apiRooms.toggle(id);
  return mapRoom(data);
}

export function getLocalRooms(): Room[] {
  try {
    return JSON.parse(localStorage.getItem('ilehya-rooms') || '[]');
  } catch { return []; }
}

export function getVillesFromRooms(rooms: Room[]): string[] {
  return [...new Set(rooms.map((r) => r.ville))].sort();
}

export function getQuartiersFromRooms(rooms: Room[]): string[] {
  return [...new Set(rooms.map((r) => r.quartier))].sort();
}
