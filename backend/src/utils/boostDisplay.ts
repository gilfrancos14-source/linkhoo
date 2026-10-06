// Affichage des campagnes boost, partagé entre routes/boosts.ts (gérant)
// et routes/admin.ts (supervision). L'état affiché est DÉRIVÉ à la lecture
// depuis le statut brut et les dates : pas de job de fond, une campagne
// « active » dont la fenêtre n'a pas commencé s'affiche « programmée ».

export type BoostRawStatus = 'pending' | 'active' | 'paused' | 'exhausted' | 'canceled';

export type BoostDisplayStatus =
  | 'pending'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'ended'
  | 'exhausted'
  | 'canceled';

export interface BoostLikeRow {
  id: string;
  market: string;
  room_id: string;
  mode: 'cpc' | 'cpi';
  status: BoostRawStatus;
  budget_total: number;
  spent: number;
  starts_at: string;
  ends_at: string;
  activated_at?: string | null;
  created_at?: string;
  updated_at?: string;
  transaction_id?: string | null;
  gerant_id?: string;
  room?: BoostRoomLike | null;
}

export interface BoostRoomLike {
  id: string;
  title: string;
  price?: string | null;
  price_num?: number | null;
  price_unit?: string | null;
  img?: string | null;
  ville?: string | null;
  quartier?: string | null;
  market?: string;
  category?: string | null;
  disponible?: boolean | null;
}

export function deriveBoostDisplayStatus(
  row: Pick<BoostLikeRow, 'status' | 'starts_at' | 'ends_at'>,
  now: Date = new Date()
): BoostDisplayStatus {
  if (row.status === 'pending') return 'pending';
  if (row.status === 'canceled') return 'canceled';
  if (row.status === 'exhausted') return 'exhausted';
  if (row.status === 'paused') return 'paused';
  const t = now.getTime();
  if (t < new Date(row.starts_at).getTime()) return 'scheduled';
  if (t > new Date(row.ends_at).getTime()) return 'ended';
  return 'live';
}

/** Champ embarqué room:rooms(...) commun à toutes les lectures boosts. */
export const BOOST_ROOM_EMBED =
  'room:rooms(id, title, price, price_num, price_unit, img, ville, quartier, market, category, disponible)';

export function mapBoostRow(row: BoostLikeRow) {
  const room = row.room ?? null;
  return {
    id: row.id,
    market: row.market,
    room_id: row.room_id,
    mode: row.mode,
    status: row.status,
    display_status: deriveBoostDisplayStatus(row),
    budget_total: row.budget_total,
    spent: row.spent,
    remaining: Math.max(row.budget_total - row.spent, 0),
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    activated_at: row.activated_at ?? null,
    created_at: row.created_at ?? null,
    room: room
      ? {
          id: room.id,
          title: room.title,
          price: room.price ?? null,
          price_num: room.price_num ?? null,
          img: room.img ?? null,
          ville: room.ville ?? null,
          quartier: room.quartier ?? null,
          market: room.market ?? row.market,
          disponible: room.disponible !== false,
        }
      : null,
  };
}
