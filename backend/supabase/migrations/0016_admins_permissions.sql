-- 0016 : comptes administrateurs multiples + permissions par section.
--
-- Contexte : aujourd'hui un seul compte admin (seed) ouvre tout le
-- back-office. On autorise le superadmin à créer d'autres comptes avec un
-- périmètre réduit (une permission par section : gerants, reservations,
-- bannieres, evenements, destinations, promotions, boosts, stats).
--
-- `is_superadmin` : droits étendus (gestion de l'équipe + tout le reste).
-- `permissions`   : jsonb = tableau de clés autorisées, ignoré pour un
--                   superadmin. Lecture à chaque requête (requirePermission)
--                   → une révocation est effective immédiatement, sans
--                   attendre l'expiration du JWT (24 h).
--
-- Promotion des comptes existants : la migration s'exécute avant tout
-- déploiement de code utilisant les nouvelles colonnes ; le compte du
-- fondateur (et tout compte créé manuellement entre-temps) devient
-- superadmin pour ne perdre aucun accès. Idempotent au second passage.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.admins
SET is_superadmin = true
WHERE is_superadmin = false;
