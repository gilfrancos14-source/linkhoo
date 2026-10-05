-- ============================================================
-- REQUÊTES À EXÉCUTER SUR SUPABASE
-- Exécuter dans l'éditeur SQL de Supabase Dashboard
-- ============================================================

-- 1. Ajouter la colonne gerant_id à la table rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS gerant_id TEXT;

-- 2. Ajouter la colonne phone à la table gerants
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Ajouter la colonne gerant_id à la table notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS gerant_id TEXT;

-- 4. Index sur rooms.gerant_id (filtrage réservations par gérant)
CREATE INDEX IF NOT EXISTS idx_rooms_gerant_id ON rooms(gerant_id);

-- 5. Index sur notifications.gerant_id (filtrage notifications par gérant)
CREATE INDEX IF NOT EXISTS idx_notifications_gerant_id ON notifications(gerant_id);

-- 6. Index sur rooms.market + gerant_id (recherche combinée)
CREATE INDEX IF NOT EXISTS idx_rooms_market_gerant ON rooms(market, gerant_id);

-- 7. Foreign key rooms.gerant_id → gerants.clerk_user_id (?optionnel, protège l'intégrité)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_gerant'
  ) THEN
    ALTER TABLE rooms ADD CONSTRAINT fk_rooms_gerant
      FOREIGN KEY (gerant_id) REFERENCES gerants(clerk_user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 8. Table premium_transactions : audit + idempotence webhook
-- ============================================================
-- Source de vérité pour l'activation premium.
-- Une ligne par transaction FedaPay, upsert par fedapay_transaction_id (UNIQUE).
-- Le webhook ET /confirm upsertent ici, et n'activent le premium QUE
-- si le statut est 'approved'. Idempotent par contrainte UNIQUE.
CREATE TABLE IF NOT EXISTS premium_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fedapay_transaction_id BIGINT UNIQUE NOT NULL,
  clerk_user_id TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('CI', 'BJ')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'canceled', 'refunded', 'expired')),
  customer_email TEXT,
  raw_event JSONB,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_tx_clerk_user_id ON premium_transactions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_premium_tx_status ON premium_transactions(status);
CREATE INDEX IF NOT EXISTS idx_premium_tx_created_at ON premium_transactions(created_at);

-- ============================================================
-- 9. Type sur premium_transactions (premium vs verification)
-- ============================================================
ALTER TABLE premium_transactions ADD COLUMN IF NOT EXISTS type TEXT
  CHECK (type IN ('premium', 'verification')) DEFAULT 'premium';
UPDATE premium_transactions SET type = 'premium' WHERE type IS NULL;

-- ============================================================
-- 10. Verification documents table
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerant_id UUID REFERENCES gerants(id) ON DELETE CASCADE,
  document_type TEXT CHECK (document_type IN ('national_id', 'selfie', 'id_card_front', 'id_card_back')) NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_docs_gerant_id ON verification_documents(gerant_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON verification_documents(status);

-- ============================================================
-- 11. Verification status sur gerants
-- ============================================================
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS verification_status TEXT
  CHECK (verification_status IN ('none', 'pending', 'under_review', 'approved', 'rejected'))
  DEFAULT 'none';
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gerants_verification_status ON gerants(verification_status);

-- Migration des données existantes
UPDATE gerants SET verification_status = 'approved' WHERE is_verified = true AND verification_status = 'none';
UPDATE gerants SET verification_status = 'pending' WHERE is_verified = false AND verification_requested_at IS NOT NULL AND verification_status = 'none';

-- ============================================================
-- 12. Bucket verification-docs (privé)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. Mettre à jour le CHECK constraint notifications.type
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('reservation', 'reservation_confirmed', 'reservation_rejected', 'verification_submitted', 'verification_approved', 'verification_rejected', 'reservation_cancelled'));

-- ============================================================
-- 14. Ajouter le type reservation_cancelled (annulation client)
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('reservation', 'reservation_confirmed', 'reservation_rejected', 'verification_submitted', 'verification_approved', 'verification_rejected', 'reservation_cancelled'));

-- ============================================================
-- 15. Vérification : CNI recto/verso + adresse Google Maps
-- ============================================================
ALTER TABLE verification_documents DROP CONSTRAINT IF EXISTS verification_documents_document_type_check;
ALTER TABLE verification_documents ADD CONSTRAINT verification_documents_document_type_check
  CHECK (document_type IN ('national_id', 'selfie', 'id_card_front', 'id_card_back'));

ALTER TABLE gerants ADD COLUMN IF NOT EXISTS property_maps_url TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS property_lat DOUBLE PRECISION;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS property_lng DOUBLE PRECISION;

-- ============================================================
-- 16. Fix critiques : id par défaut + rooms.updated_at
-- ============================================================
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE rooms ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE banners ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- ============================================================
-- 17. Row Level Security : lecture publique contenu public,
--     tables sensibles fermées au rôle anon
-- ============================================================
ALTER TABLE IF EXISTS rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gerants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS premium_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_select_rooms ON rooms;
CREATE POLICY public_select_rooms ON rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS public_select_categories ON categories;
CREATE POLICY public_select_categories ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS public_select_banners ON banners;
CREATE POLICY public_select_banners ON banners FOR SELECT USING (true);

-- ============================================================
-- 18. Réservation atomique (anti double-réservation)
-- ============================================================
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
  p_message TEXT
) RETURNS SETOF public.reservations
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
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
    date_debut, date_fin, montant, message, statut
  ) VALUES (
    p_id, p_client_name, p_client_email, p_client_phone, p_room_id, p_room_title,
    p_date_debut, p_date_fin, p_montant, p_message, 'en_attente'
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
BEGIN
  SELECT r.room_id, r.date_debut, r.date_fin
  INTO v_room_id, v_debut, v_fin
  FROM public.reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_room_id IS NOT NULL THEN
    PERFORM 1 FROM public.rooms WHERE id = v_room_id FOR UPDATE;
  END IF;
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
  RETURN QUERY
  UPDATE public.reservations
  SET statut = 'confirmee', responded_at = now()
  WHERE id = p_reservation_id
  RETURNING *;
END;
$$;

-- ============================================================
-- 19. Activation premium atomique (anti double-activation)
-- ============================================================
-- Le webhook FedaPay ET POST /api/premium/confirm arrivent presque en même
-- temps pour un paiement : sans verrou, les deux lisent activated_at NULL et
-- prolongent toutes les deux. Réclame la transaction et prolonge l'abonnement
-- dans UNE transaction SQL : soit les deux, soit rien (annulation automatique
-- en cas d'échec, jamais d'abonnement manquant après paiement).
-- `already_activated = true` signifie que la transaction était déjà consommée
-- et que l'abonnement n'a PAS été prolongé.
CREATE OR REPLACE FUNCTION public.activate_premium_checked(
  p_transaction_id UUID,
  p_days INTEGER
)
RETURNS TABLE (already_activated BOOLEAN, new_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  v_clerk_user_id TEXT;
  v_now TIMESTAMPTZ := now();
  v_expires TIMESTAMPTZ;
BEGIN
  -- 1. Verrou atomique : un seul appelant peut faire passer activated_at
  --    de NULL à une date. FOUND = false => déjà consommée, on n'y touche pas.
  UPDATE public.premium_transactions
     SET activated_at = v_now, updated_at = v_now
   WHERE id = p_transaction_id
     AND activated_at IS NULL
  RETURNING clerk_user_id INTO v_clerk_user_id;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT true, g.premium_expires_at
        FROM public.premium_transactions t
        LEFT JOIN public.gerants g ON g.clerk_user_id = t.clerk_user_id
       WHERE t.id = p_transaction_id;
    RETURN;
  END IF;

  -- 2. Prolongation depuis la date réelle. Instruction unique : le verrou de
  --    ligne rend lecture + écriture atomiques si deux transactions DISTINCTES
  --    du même gérant sont activées en même temps (rien n'est perdu).
  UPDATE public.gerants
     SET is_premium = true,
         premium_expires_at = CASE
           WHEN premium_expires_at IS NOT NULL AND premium_expires_at > v_now
             THEN premium_expires_at + make_interval(days => p_days)
           ELSE v_now + make_interval(days => p_days)
         END,
         updated_at = v_now
   WHERE clerk_user_id = v_clerk_user_id
  RETURNING premium_expires_at INTO v_expires;

  -- Gérant absent : on annule TOUT (verrou compris) plutôt que de consommer
  -- un paiement sans livrer l'abonnement.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GERANT_NOT_FOUND';
  END IF;

  RETURN QUERY SELECT false, v_expires;
END;
$$;

-- ============================================================
-- 20. Section Événements (villes + événements)
-- ============================================================
-- Une ligne = un événement. Le front regroupe par `city` : la liste des
-- cartes « villes » est dérivée de la colonne city, pas d'une liste en dur.
-- Pas de colonne `order` : le tri se fait sur event_date (cartes et couverture).
-- La couverture d'une ville = event_date du prochain événement >= today.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  market TEXT CHECK (market IN ('CI', 'BJ')) NOT NULL,
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  img TEXT,
  alt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_market_city ON events(market, city);
CREATE INDEX IF NOT EXISTS idx_events_market_date ON events(market, event_date);

-- Lecture publique uniquement : les écritures passent par le service role
-- (routes admin), qui ignore RLS.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_select_events ON events;
CREATE POLICY public_select_events ON events FOR SELECT USING (true);

-- ============================================================
-- 21. Durée de réservation : nombre + unité (nuit | mois)
-- ============================================================
-- Le client saisit une durée ; date_fin reste calculée et sert aux tests de
-- conflit. La durée est stockée pour un affichage et un audit fiables.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duree_nombre INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duree_unite TEXT;

-- Même nom que la contrainte générée à la création (schema.sql) → guard DO.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_duree_unite_check'
  ) THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_duree_unite_check
      CHECK (duree_unite IN ('nuit', 'mois'));
  END IF;
END $$;

-- La signature de la RPC change (2 params ajoutés avec défaut) :
-- CREATE OR REPLACE ne remplace pas une signature différente, il créerait une
-- seconde surcharge et rendrait l'appel rpc() ambigu → on drop toutes les
-- surcharges existantes avant de recréer.
DROP FUNCTION IF EXISTS public.create_reservation_checked;

CREATE FUNCTION public.create_reservation_checked(
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
  p_duree_unite TEXT DEFAULT NULL
) RETURNS SETOF public.reservations
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
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
    date_debut, date_fin, montant, duree_nombre, duree_unite, message, statut
  ) VALUES (
    p_id, p_client_name, p_client_email, p_client_phone, p_room_id, p_room_title,
    p_date_debut, p_date_fin, p_montant, p_duree_nombre, p_duree_unite, p_message, 'en_attente'
  )
  RETURNING *;
END;
$$;

-- Recharge le cache de schéma de PostgREST pour que rpc() voie la nouvelle
-- signature immédiatement.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- 22. Section Tourisme (destinations)
-- ============================================================
-- Une ligne = une destination touristique affichée en carte (image, titre,
-- ville, description). `featured` laisse l'admin forcer la grosse carte ;
-- sinon une destination n'est grosse carte que si sa `city` a un événement
-- dans les UPCOMING_WINDOW_DAYS prochains jours (src/utils/tourism.ts).
CREATE TABLE IF NOT EXISTS tourism_destinations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  market TEXT CHECK (market IN ('CI', 'BJ')) NOT NULL,
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  img TEXT NOT NULL,
  alt TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourism_market ON tourism_destinations(market);

-- Lecture publique uniquement : les écritures passent par le service role
-- (routes admin), qui ignore RLS.
ALTER TABLE tourism_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_select_tourism ON tourism_destinations;
CREATE POLICY public_select_tourism ON tourism_destinations FOR SELECT USING (true);

-- 23. Adresse de domicile du gérant (étape 1 de la vérification)
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS address TEXT;

-- PostgREST doit recharger son schéma pour voir la nouvelle table.
NOTIFY pgrst, 'reload schema';