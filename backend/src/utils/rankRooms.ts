/**
 * Classement « quota premium » : au plus UNE place premium toutes les
 * `PREMIUM_SLOT_RATIO` positions, dans l'ordre organique, sans jamais relire
 * toute la table.
 *
 * Principe (« tirage vers l'avant ») : on parcourt les chambres dans l'ordre
 * organique (`created_at` desc, `id` asc) ; à chaque rang premium (multiple de
 * `ratio`), on tire vers l'avant la première chambre encore en file dont le
 * gérant est premium ET éligible (fenêtre anti-monopole). Les chambres non
 * tirées sortent exactement dans leur ordre organique : un gérant premium dont
 * la chambre n'est pas boostée garde sa place naturelle.
 *
 * Le routeur ne lit qu'une fenêtre bornée de lignes (`rankWindowRows`, au plus
 * `RANK_MAX_WINDOW`), interpalle, puis découpe la page demandée : le `count`
 * SQL (le vrai total) reste inchangé.
 *
 * V2 — QUAND : `SUPABASE_DB_URL` disponible ET (> 5 000 chambres par marché OU
 * rotation quotidienne des positions exigée) → remplacer cet intercalage par la
 * RPC SQL `rooms_ranked(...)`, qui classe toute la page en base avec rotation
 * journalière (le paramètre `seed` n'existe volontairement pas ici).
 *
 * Invariants (couverts par `rankRooms.test.ts`) :
 * - chaque ligne d'entrée sort exactement une fois (ni perdue ni dupliquée) ;
 * - toute chambre déplacée vers l'avant l'est sur un rang premium ;
 * - l'ordre relatif des chambres non déplacées est l'ordre organique ;
 * - un gérant n'est boosté qu'une fois par fenêtre glissante de
 *   `perGerantWindow` positions.
 */

/** Une place premium toutes les `ratio` positions (quota = 1 sur `ratio`). */
export const PREMIUM_SLOT_RATIO = 3;

/** Fenêtre glissante anti-monopole : 1 boost/gérant au plus par 12 positions. */
export const PER_GERANT_WINDOW = 12;

/** Nombre maximal de lignes lues par requête (borne la page profonde). */
export const RANK_MAX_WINDOW = 600;

export interface RankableRoom {
  id: string;
  gerant_id?: string | null;
  created_at?: string | null;
}

export interface RankRoomsOptions {
  /** Espacement des rangs premium, par défaut `PREMIUM_SLOT_RATIO`. */
  ratio?: number;
  /** Fenêtre glissante anti-monopole, par défaut `PER_GERANT_WINDOW`. */
  perGerantWindow?: number;
}

/** Ordre organique : `created_at` décroissant, puis `id` croissant. */
export function compareOrganic(a: RankableRoom, b: RankableRoom): number {
  const aTime = a.created_at ?? '';
  const bTime = b.created_at ?? '';
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Nombre de lignes à lire depuis le début de la liste pour servir la page
 * `[offset, offset + limit[`. `null` = page trop profonde : le routeur bascule
 * sur une lecture paginée pure (ordre organique, sans boost).
 */
export function rankWindowRows(offset: number, limit: number): number | null {
  const need = offset + limit;
  if (need > RANK_MAX_WINDOW) {
    console.warn(
      `rankWindowRows : offset ${offset} + limit ${limit} > ${RANK_MAX_WINDOW}, repli sur l'ordre organique`,
    );
    return null;
  }
  return Math.min(need * PREMIUM_SLOT_RATIO, RANK_MAX_WINDOW);
}

/**
 * Intercale les chambres des gérants de `premiumGerantIds` dans l'ordre
 * organique.
 *
 * @param rooms lignes (réordonnées ici de façon idempotente)
 * @param premiumGerantIds `gerant_id` des gérants premium *actifs* (le filtre
 *   d'expiration est appliqué par l'appelant via `isPremiumActive`)
 */
export function interleaveRooms<T extends RankableRoom>(
  rooms: readonly T[],
  premiumGerantIds: ReadonlySet<string>,
  options: RankRoomsOptions = {},
): T[] {
  const ratio = Math.max(1, Math.floor(options.ratio ?? PREMIUM_SLOT_RATIO));
  const perGerantWindow = Math.max(1, Math.floor(options.perGerantWindow ?? PER_GERANT_WINDOW));

  const queue = [...rooms].sort(compareOrganic);
  if (premiumGerantIds.size === 0 || queue.length < 2) return queue;

  const ranked: T[] = [];
  const lastBoostedByGerant = new Map<string, number>();

  /** Index de la première chambre premium encore éligible (sinon -1). */
  const findBoostable = (currentRank: number): number => {
    for (let index = 0; index < queue.length; index += 1) {
      const candidate = queue[index]!;
      const gerantId = candidate.gerant_id;
      if (!gerantId || !premiumGerantIds.has(gerantId)) continue;
      const last = lastBoostedByGerant.get(gerantId);
      if (last !== undefined && currentRank - last < perGerantWindow) continue;
      return index;
    }
    return -1;
  };

  while (queue.length > 0) {
    const slot = ranked.length;
    if (slot % ratio === 0) {
      const index = findBoostable(slot);
      if (index >= 0) {
        const [boosted] = queue.splice(index, 1);
        ranked.push(boosted!);
        lastBoostedByGerant.set(boosted!.gerant_id!, slot);
        continue;
      }
      // Aucune chambre premium éligible à ce rang : la position reste organique.
    }
    ranked.push(queue.shift()!);
  }

  return ranked;
}
