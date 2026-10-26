-- Journal d'audit du back-office (F4 / traçabilité).
--
-- Une ligne par action admin sensible : connexion (succès/échec), et toute
-- mutation authentifiée (POST/PUT/PATCH/DELETE) journalisée par le middleware
-- `requireAdminAuth` (méthode, chemin, statut, IP, User-Agent).
--
-- Table accessible uniquement au `service_role` : aucune policy RLS n'est
-- créée, et les rôles `anon`/`authenticated` n'ont aucun privilège.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID,
  admin_email TEXT,
  action TEXT NOT NULL,
  method TEXT,
  path TEXT,
  status INTEGER,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id
  ON public.admin_audit_log (admin_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO service_role;
