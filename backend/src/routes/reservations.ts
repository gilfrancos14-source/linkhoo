import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { idParamsSchema } from '../validations/common';
import { createClientLimiter } from '../utils/rateLimiters';
import { isQualifiedGerant } from '../utils/gerantQualification';
import { fetchAllRows } from '../utils/fetchAll';
import { calculateMontant, unitFromPriceUnit } from '../utils/duration';
import {
  clientReservationQuerySchema,
  reservationCheckQuerySchema,
  reservationCreateSchema,
  reservationStatusSchema,
} from '../validations/reservation';

const router = Router();
const clientLimiter = createClientLimiter();

async function requireQualifiedGerant(authUserId: string): Promise<boolean> {
  const { data: gerant } = await supabaseAdmin
    .from('gerants')
    .select('is_verified, is_premium, premium_expires_at')
    .eq('clerk_user_id', authUserId)
    .maybeSingle();
  return isQualifiedGerant(gerant);
}

router.get('/', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    if (!(await requireQualifiedGerant(authUserId))) {
      return res.status(403).json({ error: "Réservations gérées par l'administrateur" });
    }

    const roomIds = await fetchAllRows<{ id: string }>((from, to) =>
      supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('gerant_id', authUserId)
        .order('id', { ascending: true })
        .range(from, to));

    const ids = roomIds.map((r) => r.id);
    if (ids.length === 0) {
      return res.json([]);
    }

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('*')
        .in('room_id', ids)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations/mine — réservations du client connecté (Clerk)
router.get('/mine', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.json([]);

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('id, room_id, room_title, date_debut, date_fin, montant, duree_nombre, duree_unite, statut, created_at, responded_at, room:rooms(img, alt, description)')
        .eq('client_email', client.email)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/client', requireClerkAuth, clientLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.json([]);

    const parsedQuery = clientReservationQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    if (
      parsedQuery.data.email &&
      parsedQuery.data.email.toLowerCase() !== client.email.toLowerCase()
    ) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('id, room_title, date_debut, date_fin, montant, duree_nombre, duree_unite, statut, created_at')
        .eq('client_email', client.email)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = reservationCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de réservation invalides' });
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, disponible, title, price_num, price_unit, gerant_id')
      .eq('id', parsedBody.data.room_id)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });
    if (!room.disponible) return res.status(409).json({ error: 'Cette chambre n\'est plus disponible' });

    // L'unité facturée est celle du tarif du gérant : le client ne peut pas
    // demander « mois » sur une chambre tarifée « / nuit » (ni l'inverse).
    const expectedUnit = unitFromPriceUnit(room.price_unit);
    if (parsedBody.data.duree_unite !== expectedUnit) {
      return res.status(400).json({ error: `Cette chambre est facturée ${room.price_unit}` });
    }

    const montant = calculateMontant(room.price_num, parsedBody.data.duree_nombre);

    const reservationId = randomUUID();
    const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('create_reservation_checked', {
      p_id: reservationId,
      p_client_name: parsedBody.data.client_name,
      p_client_email: parsedBody.data.client_email,
      p_client_phone: parsedBody.data.client_phone,
      p_room_id: parsedBody.data.room_id,
      p_room_title: room.title,
      p_date_debut: parsedBody.data.date_debut,
      p_date_fin: parsedBody.data.date_fin,
      p_montant: montant,
      p_message: parsedBody.data.message,
      p_duree_nombre: parsedBody.data.duree_nombre,
      p_duree_unite: parsedBody.data.duree_unite,
    });
    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('DATE_CONFLICT')) {
        return res.status(409).json({ error: 'Ces dates ne sont pas disponibles pour cette chambre' });
      }
      if (msg.includes('ROOM_NOT_FOUND')) {
        return res.status(404).json({ error: 'Chambre introuvable' });
      }
      throw rpcError;
    }
    const data = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!data) throw new Error('Création de réservation échouée');

    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: 'reservation',
      room_title: room.title,
      room_id: room.id,
      client_name: parsedBody.data.client_name,
      client_email: parsedBody.data.client_email,
      client_phone: parsedBody.data.client_phone,
      message: parsedBody.data.message || '',
      reservation_id: data.id,
      gerant_id: room.gerant_id || null,
    });
    if (notifError) console.error('[reservations] insert notification échoué:', notifError.message);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    const parsedBody = reservationStatusSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      return res.status(400).json({ error: 'Données de réservation invalides' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    if (!(await requireQualifiedGerant(authUserId))) {
      return res.status(403).json({ error: "Réservations gérées par l'administrateur" });
    }

    const { data: currentReservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('id, room_id, date_debut, date_fin, statut')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!currentReservation) return res.status(404).json({ error: 'Réservation introuvable' });

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('gerant_id')
      .eq('id', currentReservation.room_id)
      .maybeSingle();
    if (!room || room.gerant_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé — cette réservation ne vous appartient pas' });
    }

    let data: Record<string, unknown> | null = null;
    if (parsedBody.data.statut === 'confirmee') {
      const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('confirm_reservation_checked', {
        p_reservation_id: parsedParams.data.id,
      });
      if (rpcError) {
        const msg = rpcError.message || '';
        if (msg.includes('DATE_CONFLICT')) {
          return res.status(409).json({ error: 'Conflit de dates avec une autre réservation confirmée' });
        }
        if (msg.includes('NOT_FOUND')) {
          return res.status(404).json({ error: 'Réservation introuvable' });
        }
        throw rpcError;
      }
      data = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as Record<string, unknown> | null;
    } else {
      const { data: updated, error } = await supabaseAdmin
        .from('reservations')
        .update({ statut: parsedBody.data.statut, responded_at: new Date().toISOString() })
        .eq('id', parsedParams.data.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      data = updated;
    }
    if (!data) return res.status(404).json({ error: 'Réservation introuvable' });

    const { data: gerantData } = await supabaseAdmin
      .from('gerants')
      .select('phone, nom, prenom, is_verified, is_premium')
      .eq('clerk_user_id', room.gerant_id)
      .maybeSingle();

    res.json({ ...data, gerant_phone: gerantData?.phone || null, gerant_nom: gerantData?.nom || null, gerant_prenom: gerantData?.prenom || null, gerant_is_verified: gerantData?.is_verified || false, gerant_is_premium: gerantData?.is_premium || false });
  } catch (err) {
    next(err);
  }
});

// POST /api/reservations/:id/cancel — le client annule sa propre réservation
router.post('/:id/cancel', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.status(404).json({ error: 'Profil client introuvable' });

    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('id, client_name, client_email, client_phone, room_id, room_title, date_debut, date_fin, statut')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });

    if (reservation.client_email.toLowerCase() !== client.email.toLowerCase()) {
      return res.status(403).json({ error: 'Cette réservation ne vous appartient pas' });
    }
    if (reservation.statut === 'annulee') {
      return res.status(400).json({ error: 'Cette réservation est déjà annulée' });
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({ statut: 'annulee', responded_at: new Date().toISOString() })
      .eq('id', parsedParams.data.id)
      .select('id, room_id, room_title, date_debut, date_fin, statut, created_at')
      .single();
    if (error) throw error;

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('gerant_id')
      .eq('id', data.room_id)
      .maybeSingle();

    await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: 'reservation_cancelled',
      room_title: data.room_title,
      room_id: data.room_id,
      client_name: reservation.client_name,
      client_email: reservation.client_email,
      client_phone: reservation.client_phone,
      message: `Le client ${reservation.client_name} a annulé sa réservation du ${reservation.date_debut} au ${reservation.date_fin}`,
      reservation_id: data.id,
      gerant_id: room?.gerant_id || null,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = reservationCheckQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres de disponibilité invalides' });
    }

    let query = supabaseAdmin
      .from('reservations')
      .select('id, room_id, date_debut, date_fin, statut')
      .eq('room_id', parsedQuery.data.room_id)
      .neq('statut', 'annulee');
    if (parsedQuery.data.exclude_id) {
      query = query.neq('id', parsedQuery.data.exclude_id);
    }

    const { data: reservations, error } = await query;
    if (error) throw error;

    const newStart = new Date(parsedQuery.data.date_debut).getTime();
    const newEnd = new Date(parsedQuery.data.date_fin).getTime();
    const hasConflict = (reservations || []).some((reservation) => {
      if (!reservation.date_debut || !reservation.date_fin) return false;
      const existingStart = new Date(reservation.date_debut).getTime();
      const existingEnd = new Date(reservation.date_fin).getTime();
      return newStart < existingEnd && newEnd > existingStart;
    });

    res.json({ hasConflict });
  } catch (err) {
    next(err);
  }
});

export default router;
