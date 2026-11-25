/**
 * Taux de réponse d'un hôte, calculé depuis les demandes de réservation
 * reçues sur ses chambres :
 *
 *   réponses = demandes avec `responded_at` renseigné
 *   total    = toutes les demandes reçues (une demande encore en attente
 *              compte donc comme non répondue)
 *   taux     = arrondi(réponses / total * 100)
 *
 * Gratuit, local (PostgreSQL uniquement), mis en cache 5 min, et jamais
 * bloquant : en cas d'erreur on renvoie `rate: null` et la page masque
 * simplement l'information plutôt que d'afficher un chiffre inventé.
 */

import { supabaseAdmin } from '../config/supabase';
import { fetchAllRows } from '../utils/fetchAll';
import { SecureCache } from '../utils/SecureCache';
import { logger } from '../lib/logger';

export interface HostResponseRate {
  readonly rate: number | null;
  readonly answered: number;
  readonly total: number;
}

const EMPTY: HostResponseRate = { rate: null, answered: 0, total: 0 };
const cache = new SecureCache();
const CACHE_TTL_SECONDS = 300;

export async function hostResponseRate(
  hostClerkUserId: string | null | undefined,
): Promise<HostResponseRate> {
  if (!hostClerkUserId) return EMPTY;

  const key = `response-rate:${hostClerkUserId}`;
  const cached = cache.get<HostResponseRate>(key);
  if (cached !== undefined) return cached;

  try {
    const { data: owned } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('gerant_id', hostClerkUserId);
    const roomIds = (Array.isArray(owned) ? owned : [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (roomIds.length === 0) return EMPTY;

    const reservations = await fetchAllRows<{ responded_at: string | null }>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('responded_at')
        .in('room_id', roomIds)
        .range(from, to),
    );

    const total = reservations.length;
    const answered = reservations.filter((row) => Boolean(row.responded_at)).length;
    const result: HostResponseRate = {
      rate: total > 0 ? Math.round((answered / total) * 100) : null,
      answered,
      total,
    };
    cache.set(key, result, CACHE_TTL_SECONDS);
    return result;
  } catch (error) {
    logger.warn('[host-stats] taux de réponse indisponible (non bloquant)', {
      error: error instanceof Error ? error.message : error,
    });
    return EMPTY;
  }
}
