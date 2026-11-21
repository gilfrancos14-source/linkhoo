-- 0045 — IP d'inscription du gérant (signal géographique gratuit).
--
-- Stocke l'IP vue par l'API au moment du bootstrap gérant. Combinée à une
-- résolution geoIP côté admin, elle donne un INDICE du pays de connexion, à
-- comparer avec le marché déclaré. Ce n'est PAS une preuve (VPN/4G peuvent
-- déformer l'IP) : le refus reste manuel (KYC admin), jamais automatique.

ALTER TABLE public.gerants
  ADD COLUMN IF NOT EXISTS signup_ip TEXT;

COMMENT ON COLUMN public.gerants.signup_ip IS
  'IP client vue au bootstrap (TRUST_PROXY=1). Indice géographique, pas une preuve.';
