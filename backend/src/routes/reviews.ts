import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { createClientLimiter } from '../utils/rateLimiters';
import { reviewCreateSchema, reviewRoomQuerySchema } from '../validations/review';

const router = Router();
const reviewsLimiter = createClientLimiter();

// GET /api/reviews?room_id= — avis publics d'un appartement + agrégats
router.get('/', reviewsLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = reviewRoomQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètre room_id invalide' });
    }
    const roomId = parsedQuery.data.room_id;

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, gerant_id')
      .eq('id', roomId)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });

    const { data: roomReviews, error } = await supabaseAdmin
      .from('reviews')
      .select('id, room_id, gerant_id, client_name, note_appartement, note_gerant, commentaire, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const reviews = roomReviews || [];
    const roomAvg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.note_appartement, 0) / reviews.length
      : null;

    let gerantAvg: number | null = null;
    let gerantCount = 0;
    if (room.gerant_id) {
      const { data: gerantReviews } = await supabaseAdmin
        .from('reviews')
        .select('note_gerant')
        .eq('gerant_id', room.gerant_id);
      const list = gerantReviews || [];
      gerantCount = list.length;
      gerantAvg = list.length
        ? list.reduce((sum, r) => sum + r.note_gerant, 0) / list.length
        : null;
    }

    res.json({
      reviews,
      room_avg: roomAvg,
      room_count: reviews.length,
      gerant_avg: gerantAvg,
      gerant_count: gerantCount,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/mine — avis du client connecté
router.get('/mine', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.json([]);

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, room_id, gerant_id, client_name, reservation_id, note_appartement, note_gerant, commentaire, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/featured — derniers avis publics commentés (accueil)
router.get('/featured', reviewsLimiter, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, client_name, note_appartement, commentaire, created_at, room:rooms(title)')
      .not('commentaire', 'is', null)
      .neq('commentaire', '')
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews — publier un avis (réservation confirmée, une seule fois)
router.post('/', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = reviewCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données d\'avis invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, email, nom, prenom')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) {
      return res.status(404).json({ error: 'Profil client introuvable' });
    }

    const { data: reservation, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('id, client_email, room_id, room_title, statut')
      .eq('id', parsedBody.data.reservation_id)
      .maybeSingle();
    if (resError) throw resError;
    if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });

    if (reservation.client_email.toLowerCase() !== client.email.toLowerCase()) {
      return res.status(403).json({ error: 'Cette réservation ne vous appartient pas' });
    }
    if (reservation.statut !== 'confirmee') {
      return res.status(400).json({ error: 'Seules les réservations confirmées peuvent être notées' });
    }

    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('reservation_id', reservation.id)
      .maybeSingle();
    if (existingReview) {
      return res.status(409).json({ error: 'Vous avez déjà laissé un avis pour cette réservation' });
    }

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('gerant_id')
      .eq('id', reservation.room_id)
      .maybeSingle();

    const clientName = [client.prenom, client.nom].filter(Boolean).join(' ')
      || reservation.client_email.split('@')[0];

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        room_id: reservation.room_id,
        gerant_id: room?.gerant_id || null,
        client_id: client.id,
        client_name: clientName,
        reservation_id: reservation.id,
        note_appartement: parsedBody.data.note_appartement,
        note_gerant: parsedBody.data.note_gerant,
        commentaire: parsedBody.data.commentaire || '',
      })
      .select('id, room_id, gerant_id, client_name, reservation_id, note_appartement, note_gerant, commentaire, created_at')
      .single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
