-- ============================================================
-- admin_stats() : filtre de période (Tout / Mois / Trimestre / Année)
-- ------------------------------------------------------------
-- Le tableau de bord administrateur propose ces quatre périodes, mais la RPC
-- ignorait le choix : les mêmes chiffres revenaient toujours. La fonction
-- accepte maintenant `p_period` et borne toutes les agregations sur
-- `created_at` (mois / trimestre / année calendaires). « all » et toute valeur
-- inconnue conservent l'ancien comportement (aucune borne).
-- ============================================================

-- L'ancienne signature sans argument est remplacée par celle avec valeur par
-- défaut : on évite qu'un appel RPC sans paramètre choisisse l'ancienne.
DROP FUNCTION IF EXISTS public.admin_stats();

CREATE OR REPLACE FUNCTION public.admin_stats(p_period TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT CASE lower(coalesce(nullif(btrim(p_period), ''), 'all'))
      WHEN 'month' THEN date_trunc('month', now())
      WHEN 'quarter' THEN date_trunc('quarter', now())
      WHEN 'year' THEN date_trunc('year', now())
      ELSE NULL::timestamptz
    END AS start_at
  )
  SELECT jsonb_build_object(
    'gerants', jsonb_build_object(
      'total', (
        SELECT count(*) FROM public.gerants g, bounds b
        WHERE b.start_at IS NULL OR g.created_at >= b.start_at
      ),
      'verified', (
        SELECT count(*) FROM public.gerants g, bounds b
        WHERE is_verified IS TRUE AND (b.start_at IS NULL OR g.created_at >= b.start_at)
      ),
      'pendingVerifications', (
        SELECT count(*) FROM public.gerants g, bounds b
        WHERE verification_status IN ('pending', 'under_review')
          AND (b.start_at IS NULL OR g.created_at >= b.start_at)
      ),
      'premium', (
        SELECT count(*) FROM public.gerants g, bounds b
        WHERE COALESCE(is_premium, FALSE)
          AND (premium_expires_at IS NULL OR premium_expires_at > now())
          AND (b.start_at IS NULL OR g.created_at >= b.start_at)
      ),
      'byMarket', COALESCE(
        (
          SELECT jsonb_object_agg(g.market, g.cnt)
          FROM (
            SELECT g.market, count(*) AS cnt
            FROM public.gerants g, bounds b
            WHERE b.start_at IS NULL OR g.created_at >= b.start_at
            GROUP BY g.market
          ) g
        ),
        '{}'::jsonb
      ),
      -- Libellé « nouveaux ce mois » : reste sur le mois calendaire, quelle
      -- que soit la période affichée.
      'newThisMonth', (
        SELECT count(*) FROM public.gerants
        WHERE created_at >= date_trunc('month', now())
          AND created_at < date_trunc('month', now()) + interval '1 month'
      )
    ),
    'rooms', jsonb_build_object(
      'total', (
        SELECT count(*) FROM public.rooms r, bounds b
        WHERE b.start_at IS NULL OR r.created_at >= b.start_at
      ),
      'available', (
        SELECT count(*) FROM public.rooms r, bounds b
        WHERE disponible IS TRUE AND (b.start_at IS NULL OR r.created_at >= b.start_at)
      ),
      'unavailable', (
        SELECT count(*) FROM public.rooms r, bounds b
        WHERE disponible IS NOT TRUE AND (b.start_at IS NULL OR r.created_at >= b.start_at)
      ),
      'byMarket', COALESCE(
        (
          SELECT jsonb_object_agg(
            r.market,
            jsonb_build_object(
              'total', r.total,
              'available', r.available,
              'unavailable', r.unavailable
            )
          )
          FROM (
            SELECT
              r.market,
              count(*) AS total,
              count(*) FILTER (WHERE disponible IS TRUE) AS available,
              count(*) FILTER (WHERE disponible IS NOT TRUE) AS unavailable
            FROM public.rooms r, bounds b
            WHERE b.start_at IS NULL OR r.created_at >= b.start_at
            GROUP BY r.market
          ) r
        ),
        '{}'::jsonb
      )
    ),
    'reservations', jsonb_build_object(
      'total', (
        SELECT count(*) FROM public.reservations r, bounds b
        WHERE b.start_at IS NULL OR r.created_at >= b.start_at
      ),
      'pending', (
        SELECT count(*) FROM public.reservations r, bounds b
        WHERE statut = 'en_attente' AND (b.start_at IS NULL OR r.created_at >= b.start_at)
      ),
      'confirmed', (
        SELECT count(*) FROM public.reservations r, bounds b
        WHERE statut = 'confirmee' AND (b.start_at IS NULL OR r.created_at >= b.start_at)
      ),
      'cancelled', (
        SELECT count(*) FROM public.reservations r, bounds b
        WHERE statut = 'annulee' AND (b.start_at IS NULL OR r.created_at >= b.start_at)
      ),
      'totalRevenue', (
        SELECT COALESCE(sum(montant) FILTER (WHERE statut = 'confirmee'), 0)
        FROM public.reservations r, bounds b
        WHERE b.start_at IS NULL OR r.created_at >= b.start_at
      )
    )
  );
$$;

-- La migration 0025 retirait l'exécution au public : conserver ce verrou.
REVOKE EXECUTE ON FUNCTION public.admin_stats(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats(TEXT) TO service_role;
