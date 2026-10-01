-- Ilehya Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  subtitle TEXT,
  info TEXT,
  price TEXT,
  price_num INTEGER,
  price_unit TEXT DEFAULT '/ mois',
  img TEXT,
  alt TEXT,
  images TEXT[],
  description TEXT,
  capacity TEXT,
  category TEXT,
  market TEXT CHECK (market IN ('CI', 'BJ')) NOT NULL,
  pays TEXT,
  ville TEXT,
  quartier TEXT,
  chambres INTEGER DEFAULT 1,
  douches INTEGER DEFAULT 1,
  disponible BOOLEAN DEFAULT true,
  date_dispo TEXT,
  conditions TEXT,
  gerant_id TEXT,
  promo_group TEXT,
  promo_start TIMESTAMPTZ,
  promo_end TIMESTAMPTZ,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  img TEXT,
  alt TEXT,
  market TEXT CHECK (market IN ('CI', 'BJ')) NOT NULL
);

-- Banners table
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  section TEXT CHECK (section IN ('popular', 'promos', 'categories', 'events')) NOT NULL,
  img TEXT,
  alt TEXT,
  link TEXT,
  market TEXT CHECK (market IN ('CI', 'BJ')) NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  room_title TEXT,
  date_debut TEXT,
  date_fin TEXT,
  montant INTEGER,
  duree_nombre INTEGER,
  duree_unite TEXT CHECK (duree_unite IN ('nuit', 'mois')),
  message TEXT,
  statut TEXT CHECK (statut IN ('en_attente', 'confirmee', 'annulee')) DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Notifications table (admin)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('reservation', 'reservation_confirmed', 'reservation_rejected', 'verification_submitted', 'verification_approved', 'verification_rejected', 'reservation_cancelled')) NOT NULL,
  room_title TEXT,
  room_id TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  message TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT false,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  gerant_id TEXT
);

-- Client notifications table
CREATE TABLE IF NOT EXISTS client_notifications (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('reservation_confirmed', 'reservation_rejected')) NOT NULL,
  room_title TEXT,
  room_id TEXT,
  client_email TEXT NOT NULL,
  message TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT false
);

-- Gerants table (Clerk auth + market attribution)
CREATE TABLE IF NOT EXISTS gerants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  nom TEXT,
  prenom TEXT,
  address TEXT,
  market TEXT NOT NULL CHECK (market IN ('CI', 'BJ')),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_requested_at TIMESTAMPTZ,
  verification_status TEXT CHECK (verification_status IN ('none', 'pending', 'under_review', 'approved', 'rejected')) DEFAULT 'none',
  verification_rejection_reason TEXT,
  verification_submitted_at TIMESTAMPTZ,
  verification_reviewed_at TIMESTAMPTZ,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  property_maps_url TEXT,
  property_lat DOUBLE PRECISION,
  property_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gerants_clerk_user_id ON gerants(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_gerants_is_verified ON gerants(is_verified);
CREATE INDEX IF NOT EXISTS idx_gerants_verification_status ON gerants(verification_status);

-- Admins table (email/password auth)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom TEXT,
  prenom TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_market ON rooms(market);
CREATE INDEX IF NOT EXISTS idx_rooms_category ON rooms(category);
CREATE INDEX IF NOT EXISTS idx_rooms_disponible ON rooms(disponible);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_market ON categories(market);
CREATE INDEX IF NOT EXISTS idx_banners_market_section ON banners(market, section);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_statut ON reservations(statut);
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_client_email ON reservations(client_email);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_reservation_id ON notifications(reservation_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_email ON client_notifications(client_email);
CREATE INDEX IF NOT EXISTS idx_client_notifications_read ON client_notifications(read);
CREATE INDEX IF NOT EXISTS idx_gerants_market ON gerants(market);
CREATE INDEX IF NOT EXISTS idx_gerants_created_at ON gerants(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_promo_group ON rooms(promo_group);
CREATE INDEX IF NOT EXISTS idx_rooms_is_popular ON rooms(is_popular);
CREATE INDEX IF NOT EXISTS idx_events_market_city ON events(market, city);
CREATE INDEX IF NOT EXISTS idx_events_market_date ON events(market, event_date);
CREATE INDEX IF NOT EXISTS idx_tourism_market ON tourism_destinations(market);
CREATE INDEX IF NOT EXISTS idx_premium_tx_clerk_user_id ON premium_transactions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_premium_tx_status ON premium_transactions(status);
CREATE INDEX IF NOT EXISTS idx_premium_tx_created_at ON premium_transactions(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON newsletter_subscribers (lower(email)) WHERE unsubscribed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at ON newsletter_subscribers(created_at);

-- Verification documents table
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

-- Clients table (Clerk auth — locataires)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  nom TEXT,
  prenom TEXT,
  telephone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_clerk_user_id ON clients(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Reviews / testimonials table (clients with confirmed stays)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  gerant_id TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  reservation_id TEXT UNIQUE NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  note_appartement SMALLINT NOT NULL CHECK (note_appartement BETWEEN 1 AND 5),
  note_gerant SMALLINT NOT NULL CHECK (note_gerant BETWEEN 1 AND 5),
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_room ON reviews(room_id);
CREATE INDEX IF NOT EXISTS idx_reviews_gerant ON reviews(gerant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reservation ON reviews(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

-- Events table (section accueil « Événements »)
-- Une ligne = un événement ; le front regroupe par `city`. Pas de colonne
-- `order` : le tri se fait sur event_date (cartes et couverture de ville).
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

-- Destinations touristiques (section accueil « Tourisme »)
-- Une ligne = une destination affichée en carte (image, titre, ville,
-- description). `featured` force la grosse carte ; sinon la carte n'est
-- grosse que si `city` a un événement dans les 30 prochains jours.
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

-- Premium transactions : audit + idempotence webhook FedaPay.
-- Une ligne par transaction, upsert par fedapay_transaction_id (UNIQUE) ;
-- le premium n'est activé que si status = 'approved'.
CREATE TABLE IF NOT EXISTS premium_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fedapay_transaction_id BIGINT UNIQUE NOT NULL,
  clerk_user_id TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('CI', 'BJ')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'canceled', 'refunded', 'expired')),
  type TEXT CHECK (type IN ('premium', 'verification')) DEFAULT 'premium',
  customer_email TEXT,
  raw_event JSONB,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Newsletter : une ligne par email ; l'index unique partiel n'autorise
-- qu'un abonnement actif par adresse.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  market TEXT CHECK (market IN ('CI', 'BJ')),
  source TEXT DEFAULT 'footer',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true) ON CONFLICT DO NOTHING;

-- Storage bucket for verification documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT DO NOTHING;

-- ============================================================
-- Row Level Security : lecture publique uniquement sur le
-- contenu public ; toutes les autres tables sont fermées au
-- rôle anon (le backend utilise la service key qui bypasse la RLS)
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
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tourism_destinations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Colonnes ajoutées par les migrations (idempotent) : les bases
-- créées avant ces migrations ne sont pas couvertes par les
-- CREATE TABLE IF NOT EXISTS ci-dessus.
-- ============================================================
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS promo_group TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS promo_start TIMESTAMPTZ;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS promo_end TIMESTAMPTZ;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
ALTER TABLE premium_transactions ADD COLUMN IF NOT EXISTS type TEXT
  CHECK (type IN ('premium', 'verification')) DEFAULT 'premium';

DROP POLICY IF EXISTS public_select_rooms ON rooms;
CREATE POLICY public_select_rooms ON rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS public_select_categories ON categories;
CREATE POLICY public_select_categories ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS public_select_banners ON banners;
CREATE POLICY public_select_banners ON banners FOR SELECT USING (true);
-- Lecture publique : les écritures passent par le service role (routes admin),
-- qui bypasse la RLS.
DROP POLICY IF EXISTS public_select_events ON events;
CREATE POLICY public_select_events ON events FOR SELECT USING (true);
DROP POLICY IF EXISTS public_select_tourism ON tourism_destinations;
CREATE POLICY public_select_tourism ON tourism_destinations FOR SELECT USING (true);

-- ============================================================
-- Réservation atomique : verrou de la chambre + test de conflit
-- dans une seule transaction (anti double-réservation)
-- ============================================================
-- La signature a changé (durée de réservation) : CREATE OR REPLACE ne
-- remplace pas une signature différente, il créerait une seconde surcharge.
DROP FUNCTION IF EXISTS public.create_reservation_checked;
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

-- Confirmation atomique : anti course entre vérification et mise à jour
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
