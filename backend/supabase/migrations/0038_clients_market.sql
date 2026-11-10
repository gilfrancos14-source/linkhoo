-- 0038 - Rattachement des comptes clients à un marché
--
-- Jusqu'ici les clients étaient globaux : un compte créé depuis /ci pouvait
-- ouvrir /bj/compte et retrouver ses données. On aligne les clients sur la
-- règle déjà appliquée aux gérants : un compte appartient à UN marché.
--
-- Reprise des comptes existants :
--   1. marché de la chambre de la réservation la plus récente portant le même
--      email client (source la plus fiable disponible) ;
--   2. à défaut, CI (marché historique de la plateforme).

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS market TEXT;

WITH ranked AS (
  SELECT
    lower(r.client_email) AS client_email,
    rm.market,
    row_number() OVER (
      PARTITION BY lower(r.client_email)
      ORDER BY r.created_at DESC NULLS LAST, r.id DESC
    ) AS rank
  FROM public.reservations r
  JOIN public.rooms rm ON rm.id = r.room_id
  WHERE r.client_email IS NOT NULL
    AND rm.market IS NOT NULL
)
UPDATE public.clients c
SET market = ranked.market
FROM ranked
WHERE ranked.rank = 1
  AND c.market IS NULL
  AND lower(c.email) = ranked.client_email;

UPDATE public.clients
SET market = 'CI'
WHERE market IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN market SET NOT NULL;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_market_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_market_check
  CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD'))
  NOT VALID;

ALTER TABLE public.clients
  VALIDATE CONSTRAINT clients_market_check;

CREATE INDEX IF NOT EXISTS idx_clients_market ON public.clients(market);
