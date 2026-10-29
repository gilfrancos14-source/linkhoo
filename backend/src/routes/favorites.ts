import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireProfile } from '../middleware/requireProfile';
import { idParamsSchema } from '../validations/common';
import { createClientLimiter } from '../utils/rateLimiters';
import { ROOM_COLUMNS } from '../utils/selects';

/**
 * Favoris d'un client.
 *
 * Les favoris sont un geste explicite (clic sur le cœur) : une réservation ne
 * les crée ni ne les supprime. Toutes les routes sont réservées au rôle
 * `client` et ne manipulent que les lignes du compte Clerk courant.
 */
const router = Router();
const favoritesLimiter = createClientLimiter({ limit: 120, prefix: 'favorites' });

/** Identifiant interne du client lié au jeton Clerk, ou null. */
async function resolveClientId(req: Request): Promise<string | null> {
  const authUserId = req.auth?.userId;
  if (!authUserId) return null;
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('clerk_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

router.use(requireProfile('client'));

// GET /api/favorites — chambres favorites du client, plus récentes d'abord.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveClientId(req);
    if (!clientId) return res.json([]);

    const { data: favorites, error } = await supabaseAdmin
      .from('client_favorites')
      .select('room_id, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const favoriteRows = favorites ?? [];
    if (favoriteRows.length === 0) return res.json([]);

    const roomIds = favoriteRows.map((row: { room_id: string }) => row.room_id);
    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select(ROOM_COLUMNS)
      .in('id', roomIds);
    if (roomsError) throw roomsError;

    // L'ordre doit rester celui des favoris (created_at desc), pas celui de
    // la requête `rooms` qui n'a pas de ORDER BY.
    const roomsById = new Map(
      (rooms ?? []).map((room: { id: string }) => [room.id, room]),
    );
    const items = favoriteRows.flatMap((favorite: { room_id: string; created_at: string }) => {
      const room = roomsById.get(favorite.room_id);
      return room ? [{ ...room, favorited_at: favorite.created_at }] : [];
    });

    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/favorites/:id — ajoute une chambre aux favoris (idempotent).
router.post('/:id', favoritesLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = idParamsSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Identifiant de chambre invalide' });

    const clientId = await resolveClientId(req);
    if (!clientId) return res.status(403).json({ error: 'Accès réservé aux comptes client' });

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select(ROOM_COLUMNS)
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });

    const { error } = await supabaseAdmin
      .from('client_favorites')
      .upsert(
        { client_id: clientId, room_id: room.id },
        { onConflict: 'client_id,room_id', ignoreDuplicates: true },
      );
    if (error) throw error;

    res.status(201).json({
      room_id: room.id,
      favorite: true,
      room: { ...room, favorited_at: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/favorites/:id — retire une chambre des favoris (idempotent).
router.delete('/:id', favoritesLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = idParamsSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Identifiant de chambre invalide' });

    const clientId = await resolveClientId(req);
    if (!clientId) return res.status(403).json({ error: 'Accès réservé aux comptes client' });

    const { error } = await supabaseAdmin
      .from('client_favorites')
      .delete()
      .eq('client_id', clientId)
      .eq('room_id', parsed.data.id);
    if (error) throw error;

    res.json({ room_id: parsed.data.id, favorite: false });
  } catch (err) {
    next(err);
  }
});

export default router;
