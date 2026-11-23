-- Internationalisation des contenus de la base (phase 1 : chambres).
--
-- Les colonnes d'origine restent la source française et le fallback. Les
-- traductions générées par le worker NLLB sont stockées à part, ce qui permet
-- d'ajouter une langue sans modifier les tables métier. Une correction humaine
-- remplace la traduction automatique et n'est plus régénérée.

CREATE TABLE IF NOT EXISTS public.translations (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'auto' CHECK (status IN ('auto', 'corrige')),
  source_hash TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, locale, field)
);

CREATE INDEX IF NOT EXISTS translations_lookup_idx
  ON public.translations (entity_type, locale, entity_id);

-- File d'attente : l'API répond tout de suite, le worker traduit ensuite, un
-- job à la fois, pour ne pas saturer le VPS pendant les pics d'enregistrement.
CREATE TABLE IF NOT EXISTS public.translation_jobs (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'error', 'review')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS translation_jobs_pending_idx
  ON public.translation_jobs (status, id);
