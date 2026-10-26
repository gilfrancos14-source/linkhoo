import { supabaseAdmin } from '../config/supabase';

export interface RoomReviewStats {
  /** Moyenne des notes d'appartement, arrondie à une décimale. */
  rating: number | null;
  /** Nombre total d'avis de l'appartement (commentés ou non). */
  count: number;
}

interface ReviewNoteRow {
  room_id: string | null;
  note_appartement: number | null;
}

/**
 * Agrège les notes d'appartement pour un ensemble de chambres.
 *
 * Les moyennes affichées sur la landing (cartes sponsorisées et avis) portent
 * sur TOUS les avis de la chambre, pas seulement sur les avis commentés.
 * Une chambre sans avis n'apparaît pas dans la Map : l'appelant décide du
 * repli (note individuelle ou null).
 */
export async function fetchRoomReviewStats(
  roomIds: readonly string[],
): Promise<Map<string, RoomReviewStats>> {
  const stats = new Map<string, RoomReviewStats>();
  const ids = [...new Set(roomIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (ids.length === 0) return stats;

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('room_id, note_appartement')
    .in('room_id', ids);
  if (error) throw error;

  const sums = new Map<string, { total: number; count: number }>();
  for (const row of (data ?? []) as ReviewNoteRow[]) {
    if (!row.room_id) continue;
    const note = Number(row.note_appartement);
    if (!Number.isFinite(note)) continue;
    const current = sums.get(row.room_id) ?? { total: 0, count: 0 };
    current.total += note;
    current.count += 1;
    sums.set(row.room_id, current);
  }

  for (const [roomId, { total, count }] of sums) {
    stats.set(roomId, {
      rating: Math.round((total / count) * 10) / 10,
      count,
    });
  }

  return stats;
}
