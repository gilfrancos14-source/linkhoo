-- Pays de connexion résolu UNE SEULE FOIS au bootstrap gérant.
--
-- 0045 stockait l'IP brute (signup_ip) et obligeait l'admin à la géolocaliser
-- à chaque affichage : quota du service geoIP (45 req/min) atteint dès la première
-- liste un peu fournie, et latence proportionnelle au nombre de gérants.
-- Le résultat est désormais persisté à l'inscription ; l'admin ne fait plus
-- aucun appel réseau. Comme 0045, c'est un INDICE (VPN/4G possibles), jamais
-- une preuve : le refus reste manuel (KYC admin).

ALTER TABLE public.gerants
  ADD COLUMN IF NOT EXISTS signup_country TEXT,
  ADD COLUMN IF NOT EXISTS signup_country_name TEXT;

COMMENT ON COLUMN public.gerants.signup_country IS
  'Code ISO pays résolu depuis l''IP au bootstrap (TRUST_PROXY=1). Indice, pas une preuve.';
COMMENT ON COLUMN public.gerants.signup_country_name IS
  'Nom du pays résolu au bootstrap, libellé affiché dans le back-office.';
