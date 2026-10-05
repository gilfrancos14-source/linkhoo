-- ============================================================
-- MIGRATION D'INTÉGRITÉ (P0) — À EXÉCUTER SUR SUPABASE
-- Éditeur SQL de Supabase Dashboard. Chaque bloc est idempotent
-- (ré-exécution sans effet) et peut être exécuté séparément.
--
-- 1. Idempotence des créations : reservations.client_key
--    (anti doublon lors des rejeux de la file offline / timeouts)
-- 2. Contraintes de format et d'ordre sur les dates ISO AAAA-MM-JJ
-- 3. RPC has_date_conflict (test de chevauchement sans troncature
--    PostgREST à 1000 lignes)
-- ============================================================

-- ============================================================
-- 1. client_key : clé d'idempotence générée côté client
-- ============================================================
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS client_key TEXT;

DROP INDEX IF EXISTS reservations_client_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_client_key_unique
  ON reservations (client_key) WHERE client_key IS NOT NULL;

-- Signature actuelle (12 + p_client_key) et anciennes surcharges connues
-- (11 et 10 paramètres) : CREATE OR REPLACE ne remplace pas une signature
-- différente, il créerait une seconde surcharge → DROP explicite.
DROP FUNCTION IF EXISTS create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS create_reservation_checked(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

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
  p_message TEXT,
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
    date_debut, date_fin, montant, duree_nombre, duree_unite, message, statut, client_key
  ) VALUES (
    p_id, p_client_name, p_client_email, p_client_phone, p_room_id, p_room_title,
    p_date_debut, p_date_fin, p_montant, p_duree_nombre, p_duree_unite, p_message, 'en_attente', p_client_key
  )
  RETURNING *;
END;
$$;

-- ============================================================
-- 2. Format des dates : AAAA-MM-JJ uniquement (ISO), + ordre début < fin.
--    NOT VALID : les lignes existantes ne sont pas revérifiées (une ligne
--    historique corrompue ne bloque pas la migration) ; les nouvelles
--    écritures sont bloquées immédiatement.
-- ============================================================
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_date_debut_format;
ALTER TABLE reservations ADD CONSTRAINT reservations_date_debut_format
  CHECK (date_debut IS NULL OR date_debut ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') NOT VALID;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_date_fin_format;
ALTER TABLE reservations ADD CONSTRAINT reservations_date_fin_format
  CHECK (date_fin IS NULL OR date_fin ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') NOT VALID;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_dates_ordre;
ALTER TABLE reservations ADD CONSTRAINT reservations_dates_ordre
  CHECK (date_debut IS NULL OR date_fin IS NULL OR date_fin > date_debut) NOT VALID;

-- Une fois les éventuelles lignes historiques nettoyées (voir analyse) :
-- ALTER TABLE reservations VALIDATE CONSTRAINT reservations_date_debut_format;
-- ALTER TABLE reservations VALIDATE CONSTRAINT reservations_date_fin_format;
-- ALTER TABLE reservations VALIDATE CONSTRAINT reservations_dates_ordre;

-- ============================================================
-- 3. RPC has_date_conflict : test de chevauchement exact côté SQL
-- ============================================================
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
      AND r.statut IS DISTINCT FROM 'annulee'
      AND r.date_debut IS NOT NULL
      AND r.date_fin IS NOT NULL
      AND r.date_debut < p_date_fin
      AND r.date_fin > p_date_debut
      AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
  );
$$;
