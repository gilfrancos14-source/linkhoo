-- Préambule exécuté AVANT les migrations, sur une base PostgreSQL nue.
--
-- Les 41 migrations de `supabase/migrations/` ont été écrites pour un projet
-- Supabase : elles référencent le schéma `storage`, les rôles `anon`,
-- `authenticated` et `service_role`, et l'extension `uuid-ossp`. Sur un
-- PostgreSQL auto-hébergé ces objets n'existent pas, ce qui fait échouer la
-- première migration.
--
-- Plutôt que de réécrire 41 fichiers (et de casser le projet Supabase qui
-- tourne encore), on crée ici des doublures minimales. Tout est idempotent :
-- sur Supabase, chaque instruction est un no-op.

-- 1. Extension utilisée par les DEFAULT gen_random_uuid()/uuid_generate_v4().
--    Fournie par postgresql-contrib (présent dans l'image Docker officielle).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Schéma `storage` + table `buckets` : seules les insertions
--    `INSERT INTO storage.buckets (id, name, public)` des migrations 0001 et
--    0002 sont utilisées. Les vrais buckets vivent dans MinIO et sont créés
--    par `minio-init` (dev) ou par le script de provisionnement (prod).
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner UUID,
  public BOOLEAN DEFAULT FALSE,
  avif_autodetection BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Rôles Supabase référencés par les GRANT/REVOKE des migrations.
--    Ils sont créés NOLOGIN : aucun client ne s'y connecte, l'autorisation
--    applicative est assurée par Clerk + le rôle de connexion de l'API.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', role_name);
    END IF;
  END LOOP;
END
$$;
