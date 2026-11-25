-- Libellés des photos de logement, saisis par le gérant.
--
-- `image_labels` associe une URL de photo à un type de pièce :
--   chambre | salon | douche | cuisine | cour
-- La colonne est un JSONB (pas une table dédiée) pour rester alignée sur le
-- tableau `images` existant et ne pas casser les consommateurs actuels.
-- Les photos sans libellé restent simples URLs : rétrocompatible.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS image_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_rooms_image_labels ON public.rooms USING GIN (image_labels);
