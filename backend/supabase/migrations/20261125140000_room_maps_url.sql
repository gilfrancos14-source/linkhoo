-- Lien Google Maps de localisation du logement, saisi par le gérant lors de
-- l'ajout ou de la modification d'une annonce.
--
-- Facultatif : les annonces existantes restent valides (NULL). L'API refuse
-- toute URL qui n'est pas un lien Google Maps (javascript:, site tiers…)
-- avant persistance, afin qu'aucun href non sûr ne soit réinjecté plus tard.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS maps_url TEXT;

COMMENT ON COLUMN public.rooms.maps_url IS
  'Lien Google Maps du logement, saisi par le gérant (URL http(s) Google validée par l''API).';
