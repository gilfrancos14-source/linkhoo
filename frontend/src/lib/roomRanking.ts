import type { Room } from '../data/rooms';

/**
 * Palier de visibilité d'une chambre dans les résultats de recherche :
 * - `0` : gérant premium actif ;
 * - `1` : gérant vérifié non premium ;
 * - `2` : gérant non vérifié.
 *
 * Le drapeau `gerantPremium` est calculé côté serveur via `isPremiumActive`
 * (un abonnement expiré ne doit jamais être considéré comme actif).
 */
export type RoomTier = 0 | 1 | 2;

export function roomTier(
  room: Pick<Room, 'gerantPremium' | 'gerantVerified'>,
): RoomTier {
  if (room.gerantPremium) return 0;
  if (room.gerantVerified) return 1;
  return 2;
}

/**
 * Trie les chambres par palier gérant en conservant l'ordre reçu à
 * l'intérieur de chaque palier (tri stable explicite).
 */
export function sortRoomsByTier(rooms: readonly Room[]): Room[] {
  return rooms
    .map((room, index) => ({ room, index }))
    .sort((a, b) => roomTier(a.room) - roomTier(b.room) || a.index - b.index)
    .map(({ room }) => room);
}
