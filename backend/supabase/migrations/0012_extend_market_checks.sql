-- Migration : ouverture des marchés SN, TG, CM, BF, CG, GA, GN, ML, NE, CD.
--
-- Deux impacts :
--   1. les 9 contraintes CHECK (market IN ('CI', 'BJ')) deviennent les
--      12 codes du registre de marché (voir backend/src/config/markets.ts) ;
--   2. admin_stats() ne construit plus byMarket avec deux compteurs
--      littéraux : la carte est agrégée par GROUP BY, sparse (un marché
--      sans gérant est absent — le front comble avec 0).
--
-- Élargir une contrainte est non cassant : les lignes CI/BJ existantes
-- restent valides, l'ancien code continue de fonctionner. Motif
-- NOT VALID + VALIDATE (modèle de 0006_integrity_p0.sql) : le verrou
-- ACCESS EXCLUSIVE du ADD reste court (pas de balayage) et la validation
-- s'exécute avec SHARE UPDATE EXCLUSIVE, sans bloquer les écritures.
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. Contraintes market : 9 tables, mêmes noms auto-générés
--    <table>_market_check (confirmés en base avant écriture).
-- ============================================================
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_market_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE rooms VALIDATE CONSTRAINT rooms_market_check;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_market_check;
ALTER TABLE categories ADD CONSTRAINT categories_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE categories VALIDATE CONSTRAINT categories_market_check;

ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_market_check;
ALTER TABLE banners ADD CONSTRAINT banners_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE banners VALIDATE CONSTRAINT banners_market_check;

ALTER TABLE gerants DROP CONSTRAINT IF EXISTS gerants_market_check;
ALTER TABLE gerants ADD CONSTRAINT gerants_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE gerants VALIDATE CONSTRAINT gerants_market_check;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_market_check;
ALTER TABLE events ADD CONSTRAINT events_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE events VALIDATE CONSTRAINT events_market_check;

ALTER TABLE tourism_destinations DROP CONSTRAINT IF EXISTS tourism_destinations_market_check;
ALTER TABLE tourism_destinations ADD CONSTRAINT tourism_destinations_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE tourism_destinations VALIDATE CONSTRAINT tourism_destinations_market_check;

ALTER TABLE premium_transactions DROP CONSTRAINT IF EXISTS premium_transactions_market_check;
ALTER TABLE premium_transactions ADD CONSTRAINT premium_transactions_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE premium_transactions VALIDATE CONSTRAINT premium_transactions_market_check;

ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_market_check;
ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE newsletter_subscribers VALIDATE CONSTRAINT newsletter_subscribers_market_check;

ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_market_check;
ALTER TABLE contact_messages ADD CONSTRAINT contact_messages_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT VALID;
ALTER TABLE contact_messages VALIDATE CONSTRAINT contact_messages_market_check;

-- ============================================================
-- 2. admin_stats() : byMarket agrégé, plus de clés littérales
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'gerants', jsonb_build_object(
      'total', (SELECT count(*) FROM public.gerants),
      'verified', (SELECT count(*) FROM public.gerants WHERE is_verified IS TRUE),
      'pendingVerifications', (
        SELECT count(*) FROM public.gerants
        WHERE verification_status IN ('pending', 'under_review')
      ),
      'premium', (
        SELECT count(*) FROM public.gerants
        WHERE COALESCE(is_premium, FALSE)
          AND (premium_expires_at IS NULL OR premium_expires_at > now())
      ),
      -- Sparse : seuls les marchés ayant au moins un gérant apparaissent ;
      -- le front itère son registre et complète les clés manquantes avec 0.
      'byMarket', COALESCE(
        (
          SELECT jsonb_object_agg(g.market, g.cnt)
          FROM (
            SELECT market, count(*) AS cnt
            FROM public.gerants
            GROUP BY market
          ) g
        ),
        '{}'::jsonb
      ),
      'newThisMonth', (
        SELECT count(*) FROM public.gerants
        WHERE created_at >= date_trunc('month', now())
          AND created_at < date_trunc('month', now()) + interval '1 month'
      )
    ),
    'rooms', jsonb_build_object(
      'total', (SELECT count(*) FROM public.rooms),
      'available', (SELECT count(*) FROM public.rooms WHERE disponible IS TRUE),
      'unavailable', (SELECT count(*) FROM public.rooms WHERE disponible IS NOT TRUE)
    ),
    'reservations', jsonb_build_object(
      'total', (SELECT count(*) FROM public.reservations),
      'pending', (SELECT count(*) FROM public.reservations WHERE statut = 'en_attente'),
      'confirmed', (SELECT count(*) FROM public.reservations WHERE statut = 'confirmee'),
      'cancelled', (SELECT count(*) FROM public.reservations WHERE statut = 'annulee'),
      'totalRevenue', (
        SELECT COALESCE(sum(montant) FILTER (WHERE statut = 'confirmee'), 0)
        FROM public.reservations
      )
    )
  );
$$;
