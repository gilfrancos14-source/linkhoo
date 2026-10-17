import { randomUUID } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { requireProfile } from '../middleware/requireProfile';
import { createClientLimiter } from '../utils/rateLimiters';
import { containsPhoneNumber } from '../utils/phoneInText';
import {
  conversationCreateSchema,
  conversationParamsSchema,
  inboxQuerySchema,
  messagePageQuerySchema,
  messageSendSchema,
} from '../validations/message';

const router = Router();

// Écritures de chat bornées (30 / 15 min) : assez pour une vraie
// conversation, insuffisant pour du spam en rafale. La prise de lecture
// (markRead) est idempotente et reste sur le limiteur générique.
const messagesWriteLimiter = createClientLimiter({ limit: 30, prefix: 'messages-write' });
const messagesReadLimiter = createClientLimiter({ prefix: 'messages-read' });

router.use(requireClerkAuth);

interface ConversationRow {
  id: string;
  room_id: string;
  client_id: string;
  gerant_id: string;
  client_name: string;
  client_email: string;
  last_message_at: string | null;
  created_at: string;
}

async function findConversation(id: string): Promise<ConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select(
      'id, room_id, client_id, gerant_id, client_name, client_email, last_message_at, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ConversationRow | null) ?? null;
}

/** Rôle du participant connecté, ou null si l'utilisateur n'est pas de la
    conversation (l'appelant répond alors 404 pour ne pas révéler
    l'existence d'une conversation tierse). */
function participantRole(
  conversation: ConversationRow,
  authUserId: string,
): 'client' | 'gerant' | null {
  if (conversation.client_id === authUserId) return 'client';
  if (conversation.gerant_id === authUserId) return 'gerant';
  return null;
}

/**
 * Vrai si le gérant (identifié par son clerk_user_id) a un profil vérifié.
 *
 * Un point-lookup indexé unique par envoi : volontairement isolé plutôt
 * qu'embarqué via `conversations → rooms → gerants`. `conversations.gerant_id`
 * n'a pas de clé étrangère vers `gerants` (seul `rooms.gerant_id` en a une),
 * donc un embed PostgREST serait fragile et sans gain perceptible.
 */
async function isGerantVerified(gerantClerkUserId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select('is_verified')
    .eq('clerk_user_id', gerantClerkUserId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.is_verified);
}

// Un gérant non vérifié n'est pas joignable : ses réservations sont gérées par
// l'administrateur. On ne peut donc ni lui ouvrir une conversation, ni laisser
// un numéro transiter dans le fil tant qu'il n'est pas vérifié (le contourner
// reviendrait à court-circuiter la règle admin). Une fois vérifié — condition
// qui régit déjà l'affichage de son numéro de profil — l'échange redevient
// libre. La règle est alignée sur l'affichage, qui dépend de `is_verified` seul.
const GERANT_UNVERIFIED_ERROR =
  "Ce gérant n'est pas encore vérifié : les réservations sont gérées par l'administrateur.";
const PHONE_IN_MESSAGE_ERROR =
  "Les numéros de téléphone ne sont pas autorisés tant que le gérant n'est pas vérifié : le contact passe par la messagerie de la plateforme.";

// GET /api/messages/conversations — boîte de réception du client connecté
router.get(
  '/conversations',
  requireProfile('client'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const parsedQuery = inboxQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }

      const { data, error } = await supabaseAdmin.rpc('messages_inbox', {
        p_clerk_user_id: authUserId,
        p_side: 'client',
        p_page: parsedQuery.data.page,
        p_limit: parsedQuery.data.limit,
      });
      if (error) throw error;
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/messages/gerant/conversations — boîte de réception du gérant.
// Tous les gérants avec un profil (y compris non premium) : une conversation
// peut exister vers un gérant vérifié non premium dont la carte hôte affiche
// le bouton Message.
router.get(
  '/gerant/conversations',
  requireProfile('gerant'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const parsedQuery = inboxQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }

      const { data, error } = await supabaseAdmin.rpc('messages_inbox', {
        p_clerk_user_id: authUserId,
        p_side: 'gerant',
        p_page: parsedQuery.data.page,
        p_limit: parsedQuery.data.limit,
      });
      if (error) throw error;
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/messages/unread — compteur de non-lus du client connecté (badge
// d'en-tête sur toutes les pages). Léger : une agrégation SQL (RPC
// messages_unread_total), pas la boîte de réception entière.
router.get(
  '/unread',
  requireProfile('client'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const { data, error } = await supabaseAdmin.rpc('messages_unread_total', {
        p_clerk_user_id: authUserId,
        p_side: 'client',
      });
      if (error) throw error;
      res.json({ count: Number(data) || 0 });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/messages/gerant/unread — compteur de non-lus du gérant connecté
// (badge de l'onglet Messages de la barre latérale).
router.get(
  '/gerant/unread',
  requireProfile('gerant'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const { data, error } = await supabaseAdmin.rpc('messages_unread_total', {
        p_clerk_user_id: authUserId,
        p_side: 'gerant',
      });
      if (error) throw error;
      res.json({ count: Number(data) || 0 });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/messages/conversations — ouvrir (ou récupérer) la conversation
// du client connecté pour une chambre. Idempotent : le couple
// (room_id, client_id) est unique en base.
router.post(
  '/conversations',
  messagesWriteLimiter,
  requireProfile('client'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = conversationCreateSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ error: 'Données de conversation invalides' });
      }

      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, email, nom, prenom')
        .eq('clerk_user_id', authUserId)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!client) return res.status(404).json({ error: 'Profil client introuvable' });

      const { data: room, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('id, gerant_id')
        .eq('id', parsedBody.data.room_id)
        .maybeSingle();
      if (roomError) throw roomError;
      if (!room) return res.status(404).json({ error: 'Chambre introuvable' });
      if (!room.gerant_id) {
        return res.status(400).json({ error: 'Cette chambre n\'a pas encore de gérant joignable' });
      }
      if (!(await isGerantVerified(room.gerant_id))) {
        return res.status(403).json({ error: GERANT_UNVERIFIED_ERROR });
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('conversations')
        .select(
          'id, room_id, client_id, gerant_id, client_name, client_email, last_message_at, created_at',
        )
        .eq('room_id', room.id)
        .eq('client_id', authUserId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return res.json(existing);

      const clientName =
        [client.prenom, client.nom].filter(Boolean).join(' ') ||
        client.email.split('@')[0];

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          id: randomUUID(),
          room_id: room.id,
          client_id: authUserId,
          gerant_id: room.gerant_id,
          client_name: clientName,
          client_email: client.email,
        })
        .select(
          'id, room_id, client_id, gerant_id, client_name, client_email, last_message_at, created_at',
        )
        .single();
      if (error) {
        // Course créative : deux clics simultanés sur « Message » tentent le
        // même INSERT, le second frappe UNIQUE (room_id, client_id) — 23505.
        // On renvoie la conversation déjà créée au lieu d'un 500.
        if (error.code === '23505') {
          const { data: raced } = await supabaseAdmin
            .from('conversations')
            .select(
              'id, room_id, client_id, gerant_id, client_name, client_email, last_message_at, created_at',
            )
            .eq('room_id', room.id)
            .eq('client_id', authUserId)
            .maybeSingle();
          if (raced) return res.json(raced);
        }
        throw error;
      }
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/messages/conversations/:id — métadonnées de la conversation
// (en-tête de fil : titre de la chambre + nom du client pour le gérant).
router.get(
  '/conversations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedParams = conversationParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ error: 'Identifiant invalide' });
      }
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const conversation = await findConversation(parsedParams.data.id);
      if (!conversation || !participantRole(conversation, authUserId)) {
        return res.status(404).json({ error: 'Conversation introuvable' });
      }

      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('id, title, img, market')
        .eq('id', conversation.room_id)
        .maybeSingle();

      res.json({ ...conversation, room: room ?? null });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/messages/conversations/:id/messages — page du fil, du plus
// récent au plus ancien (le front inverse pour l'affichage chronologique).
router.get(
  '/conversations/:id/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedParams = conversationParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ error: 'Identifiant invalide' });
      }
      const parsedQuery = messagePageQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const conversation = await findConversation(parsedParams.data.id);
      if (!conversation || !participantRole(conversation, authUserId)) {
        return res.status(404).json({ error: 'Conversation introuvable' });
      }

      const { page, limit } = parsedQuery.data;
      const from = (page - 1) * limit;
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('id, conversation_id, sender_role, body, read_at, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + limit - 1);
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/messages/conversations/:id/messages — envoyer un message.
router.post(
  '/conversations/:id/messages',
  messagesWriteLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedParams = conversationParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ error: 'Identifiant invalide' });
      }
      const parsedBody = messageSendSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ error: 'Message invalide' });
      }
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const conversation = await findConversation(parsedParams.data.id);
      const role = conversation ? participantRole(conversation, authUserId) : null;
      if (!conversation || !role) {
        return res.status(404).json({ error: 'Conversation introuvable' });
      }

      // Filtre numéro tant que le gérant n'est pas vérifié, des deux côtés :
      // ni le client ni le gérant ne peuvent échanger de coordonnées en
      // contournement de la gestion admin.
      if (
        !(await isGerantVerified(conversation.gerant_id)) &&
        containsPhoneNumber(parsedBody.data.body)
      ) {
        return res.status(400).json({ error: PHONE_IN_MESSAGE_ERROR });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({
          id: randomUUID(),
          conversation_id: conversation.id,
          sender_role: role,
          body: parsedBody.data.body,
        })
        .select('id, conversation_id, sender_role, body, read_at, created_at')
        .single();
      if (error) throw error;

      const { error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', conversation.id);
      if (updateError) throw updateError;

      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/messages/conversations/:id/read — marquer les messages REÇUS
// comme lus (ceux de l'autre participant seulement).
router.post(
  '/conversations/:id/read',
  messagesReadLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedParams = conversationParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ error: 'Identifiant invalide' });
      }
      const authUserId = req.auth?.userId;
      if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

      const conversation = await findConversation(parsedParams.data.id);
      const role = conversation ? participantRole(conversation, authUserId) : null;
      if (!conversation || !role) {
        return res.status(404).json({ error: 'Conversation introuvable' });
      }

      const receivedFrom = role === 'client' ? 'gerant' : 'client';
      const { data, error } = await supabaseAdmin
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('sender_role', receivedFrom)
        .is('read_at', null)
        .select('id');
      if (error) throw error;
      res.json({ updated: data?.length ?? 0 });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
