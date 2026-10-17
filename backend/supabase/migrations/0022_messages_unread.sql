-- Migration: compteur de messages non lus par participant.
--
-- Le badge (en-tête client, onglet Messages du gérant) doit s'afficher sur
-- toutes les pages, pas seulement dans la boîte : on ne veut donc pas charger
-- la boîte complète (RPC messages_inbox, 0021) pour un simple compteur.
-- Cette fonction agrège en UNE requête, en réutilisant l'index partiel
-- idx_messages_unread (0021) et les index idx_conversations_client/gerant.
--
-- Sécurité : service_role uniquement (routes /api/messages), comme
-- messages_inbox — anon et authenticated ne doivent jamais pouvoir compter
-- les messages privés d'un tiers.
--
-- p_side : 'client' (filtre client_id) ou 'gerant' (filtre gerant_id) ;
-- validé en amont par zod côté route.
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

CREATE OR REPLACE FUNCTION public.messages_unread_total(
  p_clerk_user_id TEXT,
  p_side TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(count(*), 0)::int
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE m.read_at IS NULL
    AND m.sender_role <> p_side
    AND CASE
      WHEN p_side = 'gerant' THEN c.gerant_id = p_clerk_user_id
      ELSE c.client_id = p_clerk_user_id
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.messages_unread_total(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messages_unread_total(TEXT, TEXT)
  TO service_role;
