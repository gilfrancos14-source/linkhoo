-- Ilehya Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  img TEXT,
  alt TEXT,
  market TEXT CHECK (market IN ('CI', 'BJ')) NOT NULL
);

-- Banners table
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
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
  room_id TEXT REFERENCES rooms(id),
  room_title TEXT,
  date_debut TEXT,
  date_fin TEXT,
  montant INTEGER,
  message TEXT,
  statut TEXT CHECK (statut IN ('en_attente', 'confirmee', 'annulee')) DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Notifications table (admin)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('reservation', 'reservation_confirmed', 'reservation_rejected')) NOT NULL,
  room_title TEXT,
  room_id TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  message TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT false,
  reservation_id TEXT REFERENCES reservations(id)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_market ON rooms(market);
CREATE INDEX IF NOT EXISTS idx_rooms_category ON rooms(category);
CREATE INDEX IF NOT EXISTS idx_categories_market ON categories(market);
CREATE INDEX IF NOT EXISTS idx_banners_market_section ON banners(market, section);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_statut ON reservations(statut);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_client_notifications_email ON client_notifications(client_email);

-- Storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true) ON CONFLICT DO NOTHING;
