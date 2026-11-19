-- Migration corrective : quotas de réservations en attente.
--
-- La migration 0040 avait deux défauts :
--   1. « 2 par client et par chambre » utilisait IF EXISTS, ce qui bloquait
--      dès la 2e réservation (limite effective de 1). On passe à COUNT(*) >= 2.
--   2. La limite globale de 5 par annonce n'était vérifiée qu'à la
--      confirmation, pas à la création : un client pouvait créer autant de
--      demandes en attente qu'il voulait. On la vérifie aussi à la création.
--
-- À la confirmation, la réservation en cours est exclue du décompte global
-- (sinon confirmer la 5e demande échouait à tort).

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

  -- Rejeu d'une soumission déjà acceptée
  IF p_client_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reservations r WHERE r.client_key = p_client_key
  ) THEN
    RETURN QUERY SELECT * FROM public.reservations r WHERE r.client_key = p_client_key;
    RETURN;
  END IF;

  -- Seules les réservations CONFIRMÉES bloquent les dates
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

  -- Limite 2 par client et par chambre (fenêtre 24h)
  IF (
    SELECT COUNT(*) FROM public.reservations r
    WHERE r.room_id = p_room_id
      AND r.client_email = p_client_email
      AND r.statut = 'en_attente'
      AND r.created_at > now() - interval '24 hours'
  ) >= 2 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_PER_CLIENT_PER_ROOM';
  END IF;

  -- Limite globale 5 par annonce (tous clients, fenêtre 24h)
  IF (
    SELECT COUNT(*) FROM public.reservations r
    WHERE r.room_id = p_room_id
      AND r.statut = 'en_attente'
      AND r.created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_PER_ROOM';
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

  -- Conflit de dates avec les autres réservations confirmées
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

  -- Limite 2 par client/chambre (hors réservation en cours)
  IF (
    SELECT COUNT(*) FROM public.reservations r
    WHERE r.room_id = v_room_id
      AND r.client_email = v_client_email
      AND r.statut = 'en_attente'
      AND r.created_at > now() - interval '24 hours'
      AND r.id <> p_reservation_id
  ) >= 2 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_PER_CLIENT_PER_ROOM';
  END IF;

  -- Limite globale 5 par annonce (hors réservation en cours)
  IF (
    SELECT COUNT(*) FROM public.reservations r
    WHERE r.room_id = v_room_id
      AND r.statut = 'en_attente'
      AND r.created_at > now() - interval '24 hours'
      AND r.id <> p_reservation_id
  ) >= 5 THEN
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

NOTIFY pgrst, 'reload schema';
