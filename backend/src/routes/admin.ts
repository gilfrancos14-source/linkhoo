import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from '../utils/realtime';
import { requireAdminAuth, signAdminToken } from '../middleware/requireAdminAuth';
import { adminLoginSchema, adminChangePasswordSchema, adminReservationsQuerySchema } from '../validations/admin';
import { idParamsSchema } from '../validations/common';
import { verificationReviewSchema, verificationRejectSchema } from '../validations/gerant';
import { isQualifiedGerant } from '../utils/gerantQualification';
import { fetchAllRows } from '../utils/fetchAll';
import { z } from 'zod';

const promoGroupSchema = z.object({
  promo_group: z.enum(['promo_15', 'promo_10', 'promo_5']).nullable(),
  promo_start: z.string().nullable().optional(),
  promo_end: z.string().nullable().optional(),
}).strict();

const router = Router();

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Données invalides' });
    }

    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, password_hash, nom, prenom')
      .eq('email', parsed.data.email)
      .maybeSingle();

    if (error) throw error;
    if (!admin) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(parsed.data.password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const token = signAdminToken({ adminId: admin.id, email: admin.email });
    res.json({ token, admin: { id: admin.id, email: admin.email, nom: admin.nom, prenom: admin.prenom } });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', requireAdminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Agrégats calculés en SQL par la RPC (P1 #7) : plus de chargement des
    // tables gerants/rooms/reservations entières en mémoire.
    const { data, error } = await supabaseAdmin.rpc('admin_stats');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, nom, prenom')
      .eq('id', req.admin!.adminId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Admin introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    }

    const { data: admin, error: fetchError } = await supabaseAdmin
      .from('admins')
      .select('id, password_hash')
      .eq('id', req.admin!.adminId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!admin) return res.status(404).json({ error: 'Admin introuvable' });

    const valid = await bcrypt.compare(parsed.data.currentPassword, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const { error: updateError } = await supabaseAdmin
      .from('admins')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', admin.id);
    if (updateError) throw updateError;

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    next(err);
  }
});

// ── Gerants CRUD ──

router.get('/gerants', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { market, verification_status } = req.query;

    const runQuery = (from: number, to: number) => {
      let query = supabaseAdmin
        .from('gerants')
        .select('id, email, nom, prenom, phone, market, is_verified, verified_at, verification_requested_at, verification_status, verification_rejection_reason, verification_submitted_at, verification_reviewed_at, is_premium, property_maps_url, property_lat, property_lng, created_at')
        .order('created_at', { ascending: false })
        // created_at n'est pas unique : sans second critère, deux pages
        // peuvent se chevaucher ou se sauter des lignes.
        .order('id', { ascending: true });

      if (market && (market === 'CI' || market === 'BJ')) {
        query = query.eq('market', market);
      }
      // Un seul axe de filtrage sur l'état de vérification : `verification_status`.
      // Les anciens paramètres `pending` / `verified` n'étaient envoyés par aucun
      // client et couvraient la même information, retirés pour éviter deux
      // façons contradictoires de filtrer.
      if (verification_status && typeof verification_status === 'string') {
        query = query.eq('verification_status', verification_status);
      }

      return query.range(from, to);
    };

    const data = await fetchAllRows<any>(runQuery);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/gerants/:id/verify', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const { id } = parsedParams.data;

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/gerants/:id/revoke-verification', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const { id } = parsedParams.data;

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        is_verified: false,
        verified_at: null,
        verification_status: 'none',
        verification_rejection_reason: null,
        verification_submitted_at: null,
        verification_reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Vérification Documents Admin ──

router.get('/gerants/:id/documents', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    const { data, error } = await supabaseAdmin
      .from('verification_documents')
      .select('*')
      .eq('gerant_id', parsedParams.data.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const docsWithFreshUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        const { data: signData } = await supabaseAdmin.storage
          .from('verification-docs')
          .createSignedUrl(doc.file_path, 3600);
        return { ...doc, file_url: signData?.signedUrl ?? doc.file_url };
      })
    );
    res.json(docsWithFreshUrls);
  } catch (err) {
    next(err);
  }
});

router.patch('/documents/:docId/review', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docId = req.params.docId;
    if (!docId) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const parsedBody = verificationReviewSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('verification_documents')
      .select('id, gerant_id')
      .eq('id', docId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    const { data, error } = await supabaseAdmin
      .from('verification_documents')
      .update({
        status: parsedBody.data.status,
        rejection_reason: parsedBody.data.rejection_reason || null,
        reviewed_by: req.admin!.email,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', docId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/gerants/:id/start-review', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id, verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    if (gerant.verification_status !== 'pending') {
      return res.status(400).json({ error: 'Seules les demandes en attente peuvent être mises en révision' });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        verification_status: 'under_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedParams.data.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/gerants/:id/approve-verification', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id, clerk_user_id, verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    if (gerant.verification_status !== 'pending' && gerant.verification_status !== 'under_review') {
      return res.status(400).json({ error: 'Aucune demande de vérification en cours' });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        is_verified: true,
        verified_at: now,
        verification_status: 'approved',
        verification_rejection_reason: null,
        verification_reviewed_at: now,
        updated_at: now,
      })
      .eq('id', parsedParams.data.id)
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: 'verification_approved',
      room_title: null,
      room_id: null,
      client_name: null,
      client_email: null,
      client_phone: null,
      message: 'Votre compte a été vérifié avec succès',
      gerant_id: gerant.clerk_user_id,
    });
    void publishNotificationChanged('admin', 'gerant');

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/gerants/:id/reject-verification', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const parsedBody = verificationRejectSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id, clerk_user_id, verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    if (gerant.verification_status !== 'pending' && gerant.verification_status !== 'under_review') {
      return res.status(400).json({ error: 'Aucune demande de vérification en cours' });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        verification_status: 'rejected',
        verification_rejection_reason: parsedBody.data.rejection_reason,
        verification_reviewed_at: now,
        updated_at: now,
      })
      .eq('id', parsedParams.data.id)
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: 'verification_rejected',
      room_title: null,
      room_id: null,
      client_name: null,
      client_email: null,
      client_phone: null,
      message: `Votre demande de vérification a été rejetée : ${parsedBody.data.rejection_reason}`,
      gerant_id: gerant.clerk_user_id,
    });
    void publishNotificationChanged('admin', 'gerant');

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/verification/pending', requireAdminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('gerants')
        .select('id, email, nom, prenom, phone, market, verification_status, verification_submitted_at, property_maps_url, property_lat, property_lng')
        .in('verification_status', ['pending', 'under_review'])
        .order('verification_submitted_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Reservations (non-qualified gerants) ──

router.get('/reservations', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminReservationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    // Filtrage (qualification des gérants, statut, recherche) et pagination
    // délégués à la RPC admin_reservations en SQL (P1 #7) : plus de table
    // entière chargée puis filtrée en mémoire.
    const { data, error } = await supabaseAdmin.rpc('admin_reservations', {
      p_statut: parsed.data.statut ?? null,
      p_search: parsed.data.search ?? null,
      p_page: parsed.data.page,
      p_limit: parsed.data.limit,
    });
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/reservations/:id/check-availability', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('*, rooms!inner(gerant_id, disponible)')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });

    if (reservation.statut !== 'en_attente') {
      return res.status(400).json({ error: 'Cette réservation a déjà été traitée' });
    }

    if (!reservation.rooms?.disponible) {
      await supabaseAdmin
        .from('reservations')
        .update({ statut: 'annulee', responded_at: new Date().toISOString() })
        .eq('id', parsedParams.data.id);

      await supabaseAdmin.from('client_notifications').insert({
        id: randomUUID(),
        type: 'reservation_rejected',
        room_title: reservation.room_title,
        room_id: reservation.room_id,
        client_email: reservation.client_email,
        message: `Désolé, "${reservation.room_title}" n'est pas disponible.`,
      });
      void publishNotificationChanged('client');

      return res.json({ statut: 'annulee', reason: 'chambre_non_disponible' });
    }

    let hasConflict = false;
    const { error: rpcError } = await supabaseAdmin.rpc('confirm_reservation_checked', {
      p_reservation_id: parsedParams.data.id,
    });
    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('DATE_CONFLICT')) {
        hasConflict = true;
      } else if (msg.includes('NOT_FOUND')) {
        return res.status(404).json({ error: 'Réservation introuvable' });
      } else {
        throw rpcError;
      }
    }

    const newStatut = hasConflict ? 'annulee' : 'confirmee';
    const notifType = hasConflict ? 'reservation_rejected' : 'reservation_confirmed';
    const notifMessage = hasConflict
      ? `Désolé, "${reservation.room_title}" est déjà réservée pour les dates souhaitées.`
      : `Votre réservation pour "${reservation.room_title}" a été confirmée.`;

    if (hasConflict) {
      await supabaseAdmin
        .from('reservations')
        .update({ statut: 'annulee', responded_at: new Date().toISOString() })
        .eq('id', parsedParams.data.id);
    }

    await supabaseAdmin.from('client_notifications').insert({
      id: randomUUID(),
      type: notifType,
      room_title: reservation.room_title,
      room_id: reservation.room_id,
      client_email: reservation.client_email,
      message: notifMessage,
    });
    void publishNotificationChanged('client');

    res.json({ statut: newStatut, reason: hasConflict ? 'conflit_dates' : null });
  } catch (err) {
    next(err);
  }
});

// ── Admin notifications (non-qualified gerants' rooms) ──

router.get('/notifications', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gerants = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('gerants')
        .select('clerk_user_id, is_verified, is_premium, premium_expires_at')
        .order('clerk_user_id', { ascending: true })
        .range(from, to));

    const nonQualifiedIds = gerants
      .filter((g) => !isQualifiedGerant(g))
      .map((g) => g.clerk_user_id);

    if (nonQualifiedIds.length === 0) {
      return res.json({ notifications: [], unread_count: 0 });
    }

    const rooms = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('rooms')
        .select('id')
        .in('gerant_id', nonQualifiedIds)
        .order('id', { ascending: true })
        .range(from, to));

    const roomIds = rooms.map((r) => r.id);
    if (roomIds.length === 0) {
      return res.json({ notifications: [], unread_count: 0 });
    }

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('notifications')
        .select('*')
        .in('room_id', roomIds)
        .in('type', ['reservation', 'reservation_cancelled'])
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));

    const notifications = (data || []).map((n) => ({
      id: n.id,
      type: n.type,
      room_title: n.room_title,
      room_id: n.room_id,
      client_name: n.client_name,
      client_email: n.client_email,
      client_phone: n.client_phone,
      message: n.message,
      reservation_id: n.reservation_id,
      read: n.read,
      date: n.date,
    }));

    res.json({
      notifications,
      unread_count: notifications.filter((n) => !n.read).length,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Notification introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Promo Group ──

router.patch('/rooms/:id/promo-group', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const parsedBody = promoGroupSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const { data: room, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update({
        promo_group: parsedBody.data.promo_group,
        promo_start: parsedBody.data.promo_start || null,
        promo_end: parsedBody.data.promo_end || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
