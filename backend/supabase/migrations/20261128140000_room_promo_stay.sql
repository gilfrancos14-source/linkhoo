-- Le gérant peut fixer lui-même la fenêtre de séjour à laquelle s'applique
-- sa réduction (en nuits), en plus du groupe et des dates déjà existants.
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS promo_min_nights INTEGER,
  ADD COLUMN IF NOT EXISTS promo_max_nights INTEGER;

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_promo_min_nights_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_promo_min_nights_check
  CHECK (promo_min_nights IS NULL OR (promo_min_nights >= 1 AND promo_min_nights <= 365)) NOT VALID;
ALTER TABLE public.rooms VALIDATE CONSTRAINT rooms_promo_min_nights_check;

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_promo_max_nights_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_promo_max_nights_check
  CHECK (promo_max_nights IS NULL OR (promo_max_nights >= 1 AND promo_max_nights <= 365)) NOT VALID;
ALTER TABLE public.rooms VALIDATE CONSTRAINT rooms_promo_max_nights_check;
