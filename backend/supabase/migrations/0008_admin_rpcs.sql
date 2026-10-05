-- ============================================================
-- P1 #7 — Agrégats SQL pour le back-office
--
-- Remplace le chargement de table entière en mémoire (fetchAllRows) :
--   admin_stats()             → statistiques du tableau de bord en SQL
--   admin_reservations(...)   → liste paginée + filtrée en SQL
--
-- Sécurité : exécution réservée à service_role (clé utilisée par les
-- routes /api/admin/*). anon/authenticated ne doivent pas pouvoir appeler
-- ces fonctions via PostgREST (fuite de chiffre d'affaires et de PII
-- clients).
-- ============================================================

-- ------------------------------------------------------------
-- Statistiques agrégées du tableau de bord.
-- Règles alignées sur src/utils/premium.ts et src/utils/gerantQualification.ts :
--   - premium actif : is_premium ET (expiration absente OU future) ;
--   - vérifications en attente : verification_status pending/under_review ;
--   - disponible : « indisponible » = disponible n'est pas true (NULL inclus),
--     identique au filtre JS `!r.disponible`.
-- ------------------------------------------------------------
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
      'byMarket', jsonb_build_object(
        'CI', (SELECT count(*) FROM public.gerants WHERE market = 'CI'),
        'BJ', (SELECT count(*) FROM public.gerants WHERE market = 'BJ')
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

-- ------------------------------------------------------------
-- Liste paginée des réservations des gérants NON qualifiés.
--
-- Filtre de qualification reproduit à l'identique de l'ancien code JS
-- (isQualifiedGerant) : on garde les réservations dont la chambre a un
-- gérant qui n'est PAS (vérifié ET premium actif) — un gérant absent de
-- la table est donc conservé, comme avant. La jointure INTERNE sur rooms
-- exclut les réservations orphelines (ancien `rooms!inner`).
--
-- La recherche reproduit `String.prototype.includes` côté JS
-- (casse insensible, sans joker) via strpos(lower(...), lower(...)) :
-- pas d'échappement à gérer contrairement à ILIKE.
--
-- Retourne { items, total, page, limit, counts } :
--   - items/total/page/limit : page courante après filtre statut + recherche ;
--   - counts : compteurs des cartes du tableau de bord, calculés sur
--     l'ensemble non qualifié (indépendants du statut et de la recherche),
--     comme l'ancien calcul JS sur la liste complète.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reservations(
  p_statut TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      r.id, r.client_name, r.client_email, r.client_phone, r.room_id,
      r.room_title, r.date_debut, r.date_fin, r.montant, r.duree_nombre,
      r.duree_unite, r.message, r.statut, r.created_at, r.responded_at,
      rooms.gerant_id
    FROM public.reservations r
    JOIN public.rooms ON rooms.id = r.room_id
    WHERE rooms.gerant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.gerants g
        WHERE g.clerk_user_id = rooms.gerant_id
          AND g.is_verified IS TRUE
          AND COALESCE(g.is_premium, FALSE)
          AND (g.premium_expires_at IS NULL OR g.premium_expires_at > now())
      )
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (
      p_search IS NULL OR btrim(p_search) = ''
      OR strpos(lower(client_name), lower(p_search)) > 0
      OR strpos(lower(COALESCE(room_title, '')), lower(p_search)) > 0
      OR strpos(lower(COALESCE(client_email, '')), lower(p_search)) > 0
    )
    AND (p_statut IS NULL OR p_statut = '' OR p_statut = 'all' OR statut = p_statut)
  ),
  counts AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE statut = 'en_attente') AS pending,
      count(*) FILTER (WHERE statut = 'confirmee') AS confirmed,
      count(*) FILTER (WHERE statut = 'annulee') AS cancelled
    FROM base
  ),
  page_rows AS (
    SELECT *, count(*) OVER () AS total_count
    FROM filtered
    ORDER BY created_at DESC, id ASC
    LIMIT greatest(COALESCE(p_limit, 20), 1)
    OFFSET (greatest(COALESCE(p_page, 1), 1) - 1) * greatest(COALESCE(p_limit, 20), 1)
  )
  SELECT jsonb_build_object(
    'items', COALESCE(jsonb_agg(to_jsonb(p) - 'total_count'), '[]'::jsonb),
    'total', COALESCE(max(p.total_count), 0),
    'page', COALESCE(p_page, 1),
    'limit', greatest(COALESCE(p_limit, 20), 1),
    'counts', (
      SELECT jsonb_build_object(
        'total', c.total, 'pending', c.pending,
        'confirmed', c.confirmed, 'cancelled', c.cancelled
      )
      FROM counts c
    )
  )
  FROM page_rows p;
$$;

-- ------------------------------------------------------------
-- Droits : service_role uniquement (les routes admin passent par la
-- clé service_role). Supabase accorde EXECUTE à anon/authenticated par
-- défaut : on révoque explicitement.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_reservations(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reservations(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;
