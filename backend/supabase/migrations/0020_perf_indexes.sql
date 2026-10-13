-- Migration: index de performance pour le catalogue et les réservations.
--
-- Problème: la requête phare du catalogue (WHERE market=... ORDER BY created_at
-- DESC) et les filtres secondaires (ville, price_num) n'avaient que des index
-- mono-colonnes → bitmap scan + tri complet à chaque page. Le chargement des
-- gérants premium partait aussi à chaque appel sans index dédié.
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

-- Catalogue: tri par market + date de création (requête principale).
CREATE INDEX IF NOT EXISTS idx_rooms_market_created_at
  ON public.rooms (market, created_at DESC, id ASC);

-- Filtre ville par marché (recherche et datalist).
CREATE INDEX IF NOT EXISTS idx_rooms_market_ville
  ON public.rooms (market, ville, created_at DESC);

-- Filtre de prix (prix_min / prix_max).
CREATE INDEX IF NOT EXISTS idx_rooms_price_num
  ON public.rooms (price_num)
  WHERE price_num IS NOT NULL;

-- Badge premium : table minuscule, index partiel tiny.
CREATE INDEX IF NOT EXISTS idx_gerants_is_premium
  ON public.gerants (clerk_user_id)
  WHERE is_premium = true;

-- Classement « top réservées » (statut + date).
CREATE INDEX IF NOT EXISTS idx_reservations_statut_created
  ON public.reservations (statut, created_at DESC);

-- Chevauchement de dates pour /rooms/available (sans room_id).
CREATE INDEX IF NOT EXISTS idx_reservations_dates_overlap
  ON public.reservations (date_debut, date_fin)
  WHERE statut <> 'annulee';
