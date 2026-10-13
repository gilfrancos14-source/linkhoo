-- 0015 : bornes du budget de campagne posées en base.
--
-- Contexte : le budget est aujourd'hui libre côté API (création bornée à
-- [3 000 ; 100 000] FCFA, cf. backend/src/config/boosts.ts), mais la table
-- ne vérifiait que `budget_total > 0` : une écriture SQL directe ou un
-- futur endpoint pouvait contourner les bornes applicatives.
--
-- On pose ici la borne d'ACCEPTATION (isValidBoostBudget), volontairement
-- plus large que la borne de CRÉATION : si le produit remonte un jour le
-- minimum de création (ex. 5 000 F), les campagnes déjà payées restent
-- valides et les paiements en cours ne déclenchent pas de fausse alerte
-- `boost_paid_without_campaign`.
--
-- État au moment de l'application : table `boosts` vide (vérifié par
-- audit) → VALIDATE immédiat, aucun risque sur des lignes legacy. En cas
-- de lignes hors intervalle, la migration échoue bruyamment (aucune
-- écriture partielle) et il faudra décider d'une migration de conformité.

ALTER TABLE public.boosts DROP CONSTRAINT IF EXISTS boosts_budget_total_range;

ALTER TABLE public.boosts ADD CONSTRAINT boosts_budget_total_range
  CHECK (budget_total >= 3000 AND budget_total <= 100000);

ALTER TABLE public.boosts VALIDATE CONSTRAINT boosts_budget_total_range;
