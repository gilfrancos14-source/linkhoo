-- Trace de la remise appliquée lors de la réservation.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS promo_group TEXT,
  ADD COLUMN IF NOT EXISTS remise_percent INTEGER,
  ADD COLUMN IF NOT EXISTS montant_base INTEGER;

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_remise_percent_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_remise_percent_check
  CHECK (remise_percent IS NULL OR (remise_percent >= 0 AND remise_percent <= 100)) NOT VALID;
ALTER TABLE public.reservations VALIDATE CONSTRAINT reservations_remise_percent_check;
