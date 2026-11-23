-- Glossaire configurable pour le worker de traduction.
-- Les termes listés ici sont remplacés par leur équivalent cible AVANT
-- traduction, puis restaurés : le modèle ne peut pas les reformuler.

CREATE TABLE IF NOT EXISTS public.translation_glossary (
  source_term TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  target_term TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_term, locale)
);

INSERT INTO public.translation_glossary (source_term, locale, target_term) VALUES
  ('FCFA', 'en', 'FCFA'),
  ('FCFA', 'es', 'FCFA'),
  ('XOF', 'en', 'XOF'),
  ('XOF', 'es', 'XOF'),
  ('Linkhoo', 'en', 'Linkhoo'),
  ('Linkhoo', 'es', 'Linkhoo'),
  ('Ilehya', 'en', 'Ilehya'),
  ('Ilehya', 'es', 'Ilehya'),
  ('Côte d''Ivoire', 'en', 'Côte d''Ivoire'),
  ('Côte d''Ivoire', 'es', 'Côte d''Ivoire')
ON CONFLICT (source_term, locale) DO NOTHING;
