-- Les URLs des documents de vérification ne sont plus persistées : elles sont
-- signées à la lecture (1 h) par le backend. `file_url` devient nullable pour
-- ne plus dépendre d'une valeur fournie par le client (fallback externe).
ALTER TABLE public.verification_documents
  ALTER COLUMN file_url DROP NOT NULL;

-- Purge les URL historiques fournies par les clients : elles ne sont plus
-- lues (le backend signe `file_path` à la demande) et pourraient pointer vers
-- un hôte externe arbitraire.
UPDATE public.verification_documents
  SET file_url = NULL
  WHERE file_url IS NOT NULL;
