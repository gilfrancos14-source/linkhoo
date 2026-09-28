import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { idParamsSchema } from '../validations/common';
import { createClientLimiter } from '../utils/rateLimiters';
import { clientNotificationCreateSchema } from '../validations/notification';
import { clientReservationQuerySchema } from '../validations/reservation';
import { fetchAllRows } from '../utils/fetchAll';

const router = Router();
const notificationsLimiter = createClientLimiter();

type NotificationRow = Record<string, any> & { id: string; date: string | null };

router.get('/', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = (req as any).auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const roomIds = await fetchAllRows<{ id: string }>((from, to) =>
      supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('gerant_id', authUserId)
        .order('id', { ascending: true })
        .range(from, to));
    const ids = roomIds.map((r) => r.id);

    // Deux sources, qui se recouvrent en partie :
    //  - gerant_id = moi  → notifications sans chambre (verification_*) ;
    //  - room_id in mes chambres → gerant_id peut être null (chambre sans
    //    gérant, ou room introuvable à la création).
    // Filtrer uniquement sur room_id rendait les verification_* invisibles
    // alors que le frontend les sait déjà afficher.
    const sources: Promise<NotificationRow[]>[] = [
      fetchAllRows<NotificationRow>((from, to) =>
        supabaseAdmin
          .from('notifications')
          .select('*')
          .eq('gerant_id', authUserId)
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)),
    ];
    if (ids.length > 0) {
      sources.push(
        fetchAllRows<NotificationRow>((from, to) =>
          supabaseAdmin
            .from('notifications')
            .select('*')
            .in('room_id', ids)
            .order('date', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to)),
      );
    }

    const pages = await Promise.all(sources);

    // Dédoublonnage : une réservation est rattachée à la fois à gerant_id
    // et à room_id. Tri répliqué (date desc, id asc) identique à la base.
    const byId = new Map<string, NotificationRow>();
    for (const page of pages) {
      for (const row of page) byId.set(row.id, row);
    }

    const data = [...byId.values()].sort((a, b) => {
      const ta = a.date ? Date.parse(a.date) || 0 : 0;
      const tb = b.date ? Date.parse(b.date) || 0 : 0;
      if (tb !== ta) return tb - ta;
      if (a.id === b.id) return 0;
      return a.id < b.id ? -1 : 1;
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /  supprimé : aucun appelant frontend (seul GET /admin est utilisé) et
// aucune vérification de propriété — tout compte connecté aurait pu injecter
// une notification dans le fil d'un gérant en fournissant un roomId.
// Les notifications de réservation sont créées côté serveur
// (reservations.ts, gerants.ts) et celles de vérification par admin.ts.

router.patch('/:id/read', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = (req as any).auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: notif, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('id, gerant_id, room_id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!notif) return res.status(404).json({ error: 'Notification introuvable' });

    // On ne renvoie que nos propres notifications : celles des autres sont
    // traitées comme inexistantes (404), au même titre qu'un id inconnu.
    let isOwner = notif.gerant_id === authUserId;
    if (!isOwner && notif.room_id) {
      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('id', notif.room_id)
        .eq('gerant_id', authUserId)
        .maybeSingle();
      isOwner = !!room;
    }
    if (!isOwner) {
      return res.status(404).json({ error: 'Notification introuvable' });
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

router.get('/client', requireClerkAuth, notificationsLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = (req as any).auth?.userId;
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
        .from('client_notifications')
        .select('id, type, room_title, message, date, read')
        .eq('client_email', client.email)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/client', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = clientNotificationCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de notification invalides' });
    }

    const authUserId = (req as any).auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    // 1. La chambre doit appartenir à l'appelant. Sans ça, n'importe quel
    //    compte connecté pourrait injecter une fausse « réservation
    //    confirmée » dans le fil d'un client choisi au hasard (GET /client
    //    filtre sur le client_email, donc la victime verrait le message).
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('id', parsedBody.data.roomId)
      .eq('gerant_id', authUserId)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return res.status(403).json({ error: 'Non autorisé' });

    // 2. Ce client doit avoir une réservation sur CETTE chambre : on ne
    //    notifie que ses propres clients. L'email vient d'une réservation
    //    existante côté frontend, donc l'égalité stricte est correcte.
    const { data: reservation, error: resaError } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('room_id', parsedBody.data.roomId)
      .eq('client_email', parsedBody.data.clientEmail)
      .limit(1)
      .maybeSingle();
    if (resaError) throw resaError;
    if (!reservation) {
      return res.status(403).json({ error: 'Ce client n\'a aucune réservation sur cette chambre' });
    }

    const notification = {
      id: randomUUID(),
      type: parsedBody.data.type,
      room_title: parsedBody.data.roomTitle,
      room_id: parsedBody.data.roomId,
      client_email: parsedBody.data.clientEmail,
      message: parsedBody.data.message,
    };

    const { data, error } = await supabaseAdmin
      .from('client_notifications')
      .insert(notification)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/client/:id/read', requireClerkAuth, notificationsLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = (req as any).auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.status(404).json({ error: 'Profil client introuvable' });

    const { data: notif } = await supabaseAdmin
      .from('client_notifications')
      .select('id, client_email')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (!notif) return res.status(404).json({ error: 'Notification introuvable' });
    if (notif.client_email.toLowerCase() !== client.email.toLowerCase()) {
      // Comme pour le reste : une notification d'autrui est invisible (404).
      return res.status(404).json({ error: 'Notification introuvable' });
    }

    const { data, error } = await supabaseAdmin
      .from('client_notifications')
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

export default router;
