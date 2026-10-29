import { supabaseAdmin } from '../config/supabase';

export interface RoomReviewStats {
  /** Moyenne des notes d'appartement, arrondie à une décimale. */
  rating: number | null;
  /** Nombre total d'avis de l'appartement (commentés ou non). */
  count: number;
  /** Répartition des notes (5 → 1 étoile) : pourcentage du total, pour l'histogramme. */
  distribution: { note: number; count: number; percent: number }[];
}

interface ReviewNoteRow {
  room_id: string | null;
  note_appartement: number | null;
}

/**
 * Agrège les notes d'appartement pour un ensemble de chambres.
 *
 * Les moyennes affichées sur la landing (avis) portent sur TOUS les avis de la
 * chambre, pas seulement sur les avis commentés.
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
  const notesByRoom = new Map<string, Map<number, number>>();
  for (const row of (data ?? []) as ReviewNoteRow[]) {
    if (!row.room_id) continue;
    const note = Number(row.note_appartement);
    if (!Number.isFinite(note)) continue;
    const current = sums.get(row.room_id) ?? { total: 0, count: 0 };
    current.total += note;
    current.count += 1;
    sums.set(row.room_id, current);

    const byNote = notesByRoom.get(row.room_id) ?? new Map<number, number>();
    byNote.set(note, (byNote.get(note) ?? 0) + 1);
    notesByRoom.set(row.room_id, byNote);
  }

  for (const [roomId, { total, count }] of sums) {
    const byNote = notesByRoom.get(roomId) ?? new Map<number, number>();
    const distribution = [5, 4, 3, 2, 1].map((note) => {
      const noteCount = byNote.get(note) ?? 0;
      return {
        note,
        count: noteCount,
        percent: count > 0 ? Math.round((noteCount / count) * 1000) / 10 : 0,
      };
    });
    stats.set(roomId, {
      rating: Math.round((total / count) * 10) / 10,
      count,
      distribution,
    });
  }

  return stats;
}
