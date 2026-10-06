-- Migration: suppression du champ « message » des réservations.
-- Décision produit : plus aucun texte libre du client ne transite vers le
-- gérant. Une réservation porte des dates, une durée, un tarif et une
-- identité — rien d'autre.
--
-- Trois impacts, dans cet ordre :
--   1. la RPC de création perd le paramètre p_message (signature différente :
--      DROP explicite des surcharges, sinon CREATE OR REPLACE en créerait une
--      deuxième et l'appel rpc() deviendrait ambigu) ;
--   2. admin_reservations ne sélectionne plus r.message (sinon la fonction
--      casse dès que la colonne disparaît) ;
--   3. la colonne reservations.message est supprimée (les messages historiques
--      partent avec elle).
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. create_reservation_checked : 13 paramètres → 12
-- ============================================================
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_reservation_checked(
  p_id TEXT,
  p_client_name TEXT,
  p_client_email TEXT,
  p_client_phone TEXT,
  p_room_id TEXT,
  p_room_title TEXT,
  p_date_debut TEXT,
  p_date_fin TEXT,
  p_montant INTEGER,
  p_duree_nombre INTEGER DEFAULT NULL,
  p_duree_unite TEXT DEFAULT NULL,
  p_client_key TEXT DEFAULT NULL
) RETURNS SETOF public.reservations
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
  END IF;
  -- Rejeu d'une soumission déjà acceptée : on renvoie la réservation
  -- existante au lieu de lever DATE_CONFLICT ni d'en créer une 2e.
  IF p_client_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reservations r WHERE r.client_key = p_client_key
  ) THEN
    RETURN QUERY SELECT * FROM public.reservations r WHERE r.client_key = p_client_key;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.room_id = p_room_id
      AND r.statut IS DISTINCT FROM 'annulee'
      AND r.date_debut IS NOT NULL
      AND r.date_fin IS NOT NULL
      AND r.date_debut < p_date_fin
      AND r.date_fin > p_date_debut
  ) THEN
    RAISE EXCEPTION 'DATE_CONFLICT';
  END IF;
  RETURN QUERY
  INSERT INTO public.reservations (
    id, client_name, client_email, client_phone, room_id, room_title,
    date_debut, date_fin, montant, duree_nombre, duree_unite, statut, client_key
  ) VALUES (
    p_id, p_client_name, p_client_email, p_client_phone, p_room_id, p_room_title,
    p_date_debut, p_date_fin, p_montant, p_duree_nombre, p_duree_unite, 'en_attente', p_client_key
  )
  RETURNING *;
END;
$$;

-- ============================================================
-- 2. admin_reservations : plus de r.message dans le SELECT
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_reservations(TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.admin_reservations(
  p_statut TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      r.id, r.client_name, r.client_email, r.client_phone, r.room_id,
      r.room_title, r.date_debut, r.date_fin, r.montant, r.duree_nombre,
      r.duree_unite, r.statut, r.created_at, r.responded_at,
      rooms.gerant_id
    FROM public.reservations r
    JOIN public.rooms ON rooms.id = r.room_id
    WHERE rooms.gerant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.gerants g
        WHERE g.clerk_user_id = rooms.gerant_id
          AND g.is_verified IS TRUE
          AND COALESCE(g.is_premium, FALSE)
          AND (g.premium_expires_at IS NULL OR g.premium_expires_at > now())
      )
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (
      p_search IS NULL OR btrim(p_search) = ''
      OR strpos(lower(client_name), lower(p_search)) > 0
      OR strpos(lower(COALESCE(room_title, '')), lower(p_search)) > 0
      OR strpos(lower(COALESCE(client_email, '')), lower(p_search)) > 0
    )
    AND (p_statut IS NULL OR p_statut = '' OR p_statut = 'all' OR statut = p_statut)
  ),
  counts AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE statut = 'en_attente') AS pending,
      count(*) FILTER (WHERE statut = 'confirmee') AS confirmed,
      count(*) FILTER (WHERE statut = 'annulee') AS cancelled
    FROM base
  ),
  page_rows AS (
    SELECT *, count(*) OVER () AS total_count
    FROM filtered
    ORDER BY created_at DESC, id ASC
    LIMIT greatest(COALESCE(p_limit, 20), 1)
    OFFSET (greatest(COALESCE(p_page, 1), 1) - 1) * greatest(COALESCE(p_limit, 20), 1)
  )
  SELECT jsonb_build_object(
    'items', COALESCE(jsonb_agg(to_jsonb(p) - 'total_count'), '[]'::jsonb),
    'total', COALESCE(max(p.total_count), 0),
    'page', COALESCE(p_page, 1),
    'limit', greatest(COALESCE(p_limit, 20), 1),
    'counts', (
      SELECT jsonb_build_object(
        'total', c.total, 'pending', c.pending,
        'confirmed', c.confirmed, 'cancelled', c.cancelled
      )
      FROM counts c
    )
  )
  FROM page_rows p;
$$;

-- Droits : service_role uniquement, révocation explicite comme dans 0008
-- (Supabase accorde EXECUTE à anon/authenticated par défaut).
REVOKE EXECUTE ON FUNCTION public.admin_reservations(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reservations(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

-- ============================================================
-- 3. La colonne disparaît (les anciens messages partent avec elle)
-- ============================================================
ALTER TABLE reservations DROP COLUMN IF EXISTS message;

-- Recharge le cache de schéma de PostgREST pour que rpc() voie les
-- nouvelles signatures immédiatement.
NOTIFY pgrst, 'reload schema';
