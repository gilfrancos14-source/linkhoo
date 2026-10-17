-- Migration: messagerie in-app client ↔ gérant, adossée à une chambre.
--
-- Un client intéressé par une chambre ouvre une conversation avec le gérant
-- de CETTE chambre (une seule par couple room/client, clé UNIQUE). Le client
-- envoie depuis la fiche chambre ; les deux parties lisent/écrivent depuis
-- leur boîte de réception (/messages côté client, /gerant/messages côté
-- gérant). Le front interroge le serveur toutes les ~12 s (pas de WebSocket).
--
-- Identité : clés Clerk en TEXT, comme rooms.gerant_id (FK → gerants.
-- clerk_user_id, 0002) et boosts.gerant_id (0013). client_id = clients.
-- clerk_user_id ; client_name / client_email sont dénormalisés à la création
-- (même motif que reservations.client_name), gerant_id est copié de la room.
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  gerant_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (room_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_client
  ON public.conversations (client_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_gerant
  ON public.conversations (gerant_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'gerant')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (conversation_id, created_at DESC, id);
-- Index partiel : alimente unread_count du RPC inbox sans balayer les
-- milliers de messages déjà lus d'une conversation active.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (conversation_id)
  WHERE read_at IS NULL;

-- Motif de 0019 / 0001 : tables fermées au rôle anon (clé publique par
-- conception) ; toutes les lectures et écritures passent par le service
-- role du backend. Aucune policy créée.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Boîte de réception : conversations d'un participant, triées par dernier
-- message, avec room, dernier message et compteur de non-lus agrégés en
-- UNE requête SQL (une seule traversée réseau via PostgREST /rpc).
--
-- Sécurité : service_role uniquement (routes /api/messages). anon et
-- authenticated ne doivent pas pouvoir appeler cette fonction (fuite de
-- noms, emails et messages privés).
--
-- p_side : 'client' (filtre client_id) ou 'gerant' (filtre gerant_id) ;
-- validé en amont par zod côté route.
-- Retourne { items, total, page, limit }.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messages_inbox(
  p_clerk_user_id TEXT,
  p_side TEXT,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH owned AS (
    SELECT c.*
    FROM public.conversations c
    WHERE CASE
      WHEN p_side = 'gerant' THEN c.gerant_id = p_clerk_user_id
      ELSE c.client_id = p_clerk_user_id
    END
  ),
  paged AS (
    SELECT o.*
    FROM owned o
    ORDER BY COALESCE(o.last_message_at, o.created_at) DESC, o.id ASC
    LIMIT greatest(COALESCE(p_limit, 30), 1)
    OFFSET (greatest(COALESCE(p_page, 1), 1) - 1) * greatest(COALESCE(p_limit, 30), 1)
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'room_id', p.room_id,
        'client_id', p.client_id,
        'gerant_id', p.gerant_id,
        'client_name', p.client_name,
        'client_email', p.client_email,
        'last_message_at', p.last_message_at,
        'created_at', p.created_at,
        'room', jsonb_build_object(
          'id', r.id, 'title', r.title, 'img', r.img, 'market', r.market
        ),
        'last_message', (
          SELECT jsonb_build_object(
            'id', m.id, 'sender_role', m.sender_role, 'body', m.body,
            'created_at', m.created_at, 'read_at', m.read_at
          )
          FROM public.messages m
          WHERE m.conversation_id = p.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ),
        'unread_count', (
          SELECT count(*)
          FROM public.messages m2
          WHERE m2.conversation_id = p.id
            AND m2.read_at IS NULL
            AND m2.sender_role <> p_side
        )
      ) ORDER BY COALESCE(p.last_message_at, p.created_at) DESC, p.id ASC)
      FROM paged p
      JOIN public.rooms r ON r.id = p.room_id
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM owned),
    'page', greatest(COALESCE(p_page, 1), 1),
    'limit', greatest(COALESCE(p_limit, 30), 1)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.messages_inbox(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messages_inbox(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;
