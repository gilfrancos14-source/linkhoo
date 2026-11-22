-- Recherche textuelle insensible aux accents et à la casse.
--
-- `ILIKE` est insensible à la casse mais PAS aux accents : une recherche
-- « bouake » ne trouvait pas « Bouaké », ni « elegeant » « Élégant ». On
-- maintient donc une colonne interne dénuée d'accents, calculée à l'écriture,
-- et les filtres `q` de l'API portent dessus. La colonne n'est pas exposée
-- dans ROOM_COLUMNS : c'est un détail d'implémentation.

CREATE EXTENSION IF NOT EXISTS "unaccent";

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS search_text TEXT;

CREATE OR REPLACE FUNCTION public.rooms_search_text() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := unaccent(lower(concat_ws(' ',
    NEW.title, NEW.subtitle, NEW.info, NEW.description,
    NEW.ville, NEW.quartier, NEW.category, NEW.conditions
  )));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_search_text_trigger ON public.rooms;
CREATE TRIGGER rooms_search_text_trigger
  BEFORE INSERT OR UPDATE OF title, subtitle, info, description,
                           ville, quartier, category, conditions
  ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.rooms_search_text();

-- Rattrapage des annonces déjà en base (le trigger ne couvre que les écritures).
UPDATE public.rooms
SET search_text = unaccent(lower(concat_ws(' ',
  title, subtitle, info, description, ville, quartier, category, conditions
)))
WHERE search_text IS NULL;
