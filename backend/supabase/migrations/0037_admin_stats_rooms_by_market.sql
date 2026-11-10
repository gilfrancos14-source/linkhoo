-- ============================================================
-- admin_stats() : ajoute la répartition des chambres par marché
-- ------------------------------------------------------------
-- Le tableau de bord administrateur affiche un graphique des chambres
-- (disponibles / occupées) pour chaque marché. La RPC renvoie donc un
-- objet `rooms.byMarket` indexé par code marché, en plus des totaux.
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
      'unavailable', (SELECT count(*) FROM public.rooms WHERE disponible IS NOT TRUE),
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
              market,
              count(*) AS total,
              count(*) FILTER (WHERE disponible IS TRUE) AS available,
              count(*) FILTER (WHERE disponible IS NOT TRUE) AS unavailable
            FROM public.rooms
            GROUP BY market
          ) r
        ),
        '{}'::jsonb
      )
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
