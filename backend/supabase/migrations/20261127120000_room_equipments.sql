-- Équipements cochés par le gérant et service de restauration de l'annonce.
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS equipments TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS restauration TEXT NOT NULL DEFAULT 'aucune';

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_restauration_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_restauration_check
  CHECK (restauration IN ('aucune', 'petit_dejeuner_inclus', 'petit_dejeuner_option', 'repas_sur_demande', 'restaurant')) NOT VALID;
ALTER TABLE public.rooms VALIDATE CONSTRAINT rooms_restauration_check;

CREATE INDEX IF NOT EXISTS idx_rooms_equipments ON public.rooms USING GIN (equipments);
