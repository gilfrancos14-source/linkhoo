-- Notes par critère renseignées par le client lors de l'avis.
-- NULL pour les avis historiques : la fiche chambre affiche alors « — »
-- au lieu d'inventer une note.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS note_proprete INTEGER,
  ADD COLUMN IF NOT EXISTS note_exactitude INTEGER,
  ADD COLUMN IF NOT EXISTS note_arrivee INTEGER,
  ADD COLUMN IF NOT EXISTS note_communication INTEGER,
  ADD COLUMN IF NOT EXISTS note_emplacement INTEGER,
  ADD COLUMN IF NOT EXISTS note_rapport_qualite_prix INTEGER;

DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'note_proprete', 'note_exactitude', 'note_arrivee',
    'note_communication', 'note_emplacement', 'note_rapport_qualite_prix'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_%I_check', col
    );
    EXECUTE format(
      'ALTER TABLE public.reviews ADD CONSTRAINT reviews_%I_check CHECK (%I IS NULL OR (%I >= 1 AND %I <= 5)) NOT VALID',
      col, col, col, col
    );
    EXECUTE format('ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_%I_check', col);
  END LOOP;
END $$;
