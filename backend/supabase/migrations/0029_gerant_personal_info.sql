-- Informations personnelles affichées à l'admin pour vérifier manuellement
-- les données déclarées par le gérant face à ses documents.
ALTER TABLE public.gerants
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE public.gerants
  ADD COLUMN IF NOT EXISTS nationality TEXT;
