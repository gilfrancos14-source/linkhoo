-- Migration: expiration des demandes en_attente (anti-DoS des calendriers).
--
-- Problème: une réservation en_attente non traitée par le gérant bloquait
-- les dates indéfiniment (create_reservation_checked / has_date_conflict
-- ignorent tout statut sauf 'annulee'). ~30 appels POST anonymes gelaient
-- une annonce pour toujours.
--
-- Correctif:
--   1. create_reservation_checked n'appose DATE_CONFLICT que sur des
--      réservations CONFIRMÉES ou des en_attente créées il y a < 48 h ;
--   2. has_date_conflict applique la même règle (source de vérité du /check) ;
--   3. une fonction expire_stale_pending_reservations() force l'expiration
--      (utile pour un cron éventuel ; le Node appelle aussi l'équivalent
--      à chaque POST /check et POST /).
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. create_reservation_checked : les en_attente > 48 h ne bloquent plus
-- ============================================================
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);
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
      AND r.date_debut IS NOT NULL
      AND r.date_fin IS NOT NULL
      AND r.date_debut < p_date_fin
      AND r.date_fin > p_date_debut
      AND (
        r.statut = 'confirmee'
        OR (
          r.statut = 'en_attente'
          AND r.created_at > now() - interval '48 hours'
        )
      )
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
-- 2. has_date_conflict : même règle de fraîcheur
-- ============================================================
DROP FUNCTION IF EXISTS public.has_date_conflict(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.has_date_conflict(
  p_room_id TEXT,
  p_date_debut TEXT,
  p_date_fin TEXT,
  p_exclude_id TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.room_id = p_room_id
      AND r.date_debut IS NOT NULL
      AND r.date_fin IS NOT NULL
      AND r.date_debut < p_date_fin
      AND r.date_fin > p_date_debut
      AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
      AND (
        r.statut = 'confirmee'
        OR (
          r.statut = 'en_attente'
          AND r.created_at > now() - interval '48 hours'
        )
      )
  );
$$;

-- ============================================================
-- 3. Expiration forcée (cron éventuel ; le Node fait aussi de son côté)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_pending_reservations(
  p_ttl_hours INTEGER DEFAULT 48
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.reservations
  SET statut = 'annulee',
      responded_at = now()
  WHERE statut = 'en_attente'
    AND created_at < now() - make_interval(hours => greatest(COALESCE(p_ttl_hours, 48), 1));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_reservations(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_pending_reservations(INTEGER)
  TO service_role;

-- Recharge le cache de schéma de PostgREST pour que rpc() voie les
-- nouvelles signatures immédiatement.
NOTIFY pgrst, 'reload schema';
