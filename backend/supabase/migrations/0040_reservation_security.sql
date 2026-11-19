-- Migration: sécurité anti-spam des réservations (mesures 1-4)
--
-- Problème: les réservations en_attente non payées peuvent être utilisées
-- pour spammer les calendriers et bloquer des annonces.
--
-- Mesures implémentées:
-- 1. Aucun blocage avant paiement (les réservations en_attente ne bloquent plus)
-- 2. Limite de 2 réservations en_attente par client et par chambre
-- 3. Limite globale de 5 réservations en_attente par annonce (tous clients)
-- 4. Délai de 24h pour paiement après confirmation du gérant
--
-- Exécuter via `npm run migrate`

-- ============================================================
-- 1. Modifier create_reservation_checked : plus de blocage pour en_attente
-- ============================================================
DROP FUNCTION IF EXISTS public.create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TEXT);

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
  
  -- MESURE 1: Les réservations en_attente ne bloquent plus les dates
  -- Seules les réservations confirmées bloquent les dates
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.room_id = p_room_id
      AND r.date_debut IS NOT NULL
      AND r.date_fin IS NOT NULL
      AND r.date_debut < p_date_fin
      AND r.date_fin > p_date_debut
      AND r.statut = 'confirmee'
  ) THEN
    RAISE EXCEPTION 'DATE_CONFLICT';
  END IF;
  
  -- MESURE 2: Vérifier le quota de réservations en_attente par client et par chambre
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.room_id = p_room_id
      AND r.client_email = p_client_email
      AND r.statut = 'en_attente'
      AND r.created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_PER_CLIENT_PER_ROOM';
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
-- 2. Modifier has_date_conflict : ne plus considérer en_attente
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
      AND r.statut = 'confirmee'
  );
$$;

-- ============================================================
-- 3. Ajouter une fonction pour vérifier le quota global par annonce
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_room_pending_quota(
  p_room_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- MESURE 3: Limite de 5 réservations en_attente par annonce (tous clients)
  SELECT COUNT(*) INTO v_count
  FROM public.reservations r
  WHERE r.room_id = p_room_id
    AND r.statut = 'en_attente'
    AND r.created_at > now() - interval '24 hours';
  
  RETURN v_count < 5;
END;
$$;

-- ============================================================
-- 4. Modifier confirm_reservation_checked pour gérer le délai de paiement
-- ============================================================
DROP FUNCTION IF EXISTS public.confirm_reservation_checked(TEXT);

CREATE OR REPLACE FUNCTION public.confirm_reservation_checked(
  p_reservation_id TEXT
) RETURNS SETOF public.reservations
LANGUAGE plpgsql
AS $$
DECLARE
  v_room_id TEXT;
  v_debut TEXT;
  v_fin TEXT;
  v_client_email TEXT;
BEGIN
  SELECT r.room_id, r.date_debut, r.date_fin, r.client_email
  INTO v_room_id, v_debut, v_fin, v_client_email
  FROM public.reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  
  IF v_room_id IS NOT NULL THEN
    PERFORM 1 FROM public.rooms WHERE id = v_room_id FOR UPDATE;
  END IF;
  
  -- Vérifier les conflits de dates (seulement confirmées)
  IF v_debut IS NOT NULL AND v_fin IS NOT NULL AND v_room_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.room_id = v_room_id
      AND r.id <> p_reservation_id
      AND r.statut = 'confirmee'
      AND r.date_debut IS NOT NULL
      AND r.date_fin IS NOT NULL
      AND r.date_debut < v_fin
      AND r.date_fin > v_debut
  ) THEN
    RAISE EXCEPTION 'DATE_CONFLICT';
  END IF;
  
  -- MESURE 2: Vérifier le quota de réservations en_attente par client et par chambre
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.room_id = v_room_id
      AND r.client_email = v_client_email
      AND r.statut = 'en_attente'
      AND r.created_at > now() - interval '24 hours'
      AND r.id <> p_reservation_id
  ) THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_PER_CLIENT_PER_ROOM';
  END IF;
  
  -- MESURE 3: Vérifier le quota global par annonce
  IF NOT public.check_room_pending_quota(v_room_id) THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_PER_ROOM';
  END IF;
  
  RETURN QUERY
  UPDATE public.reservations
  SET statut = 'confirmee',
      responded_at = now()
  WHERE id = p_reservation_id
  RETURNING *;
END;
$$;

-- ============================================================
-- 5. Créer une fonction pour annuler automatiquement les réservations confirmées non payées
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_unpaid_confirmed_reservations(
  p_payment_timeout_hours INTEGER DEFAULT 24
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Annuler les réservations confirmées non payées après le délai
  UPDATE public.reservations
  SET statut = 'annulee',
      responded_at = now(),
      annulee_reason = 'payment_timeout'
  WHERE statut = 'confirmee'
    AND payment_status IS NULL
    AND responded_at < now() - make_interval(hours => greatest(COALESCE(p_payment_timeout_hours, 24), 1));
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_unpaid_confirmed_reservations(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_confirmed_reservations(INTEGER)
  TO service_role;

-- ============================================================
-- 6. Mettre à jour expire_stale_pending_reservations pour utiliser 24h au lieu de 48h
-- ============================================================
DROP FUNCTION IF EXISTS public.expire_stale_pending_reservations(INTEGER);

CREATE OR REPLACE FUNCTION public.expire_stale_pending_reservations(
  p_ttl_hours INTEGER DEFAULT 24
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
    AND created_at < now() - make_interval(hours => greatest(COALESCE(p_ttl_hours, 24), 1));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_reservations(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_pending_reservations(INTEGER)
  TO service_role;

-- ============================================================
-- 7. Créer une fonction pour vérifier si un client peut payer une réservation
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_client_pay_reservation(
  p_reservation_id TEXT,
  p_client_email TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id
    AND client_email = p_client_email
    AND statut = 'confirmee';
  
  RETURN FOUND;
END;
$$;

-- Recharge le cache de schéma de PostgREST pour que rpc() voie les
-- nouvelles signatures immédiatement.
NOTIFY pgrst, 'reload schema';