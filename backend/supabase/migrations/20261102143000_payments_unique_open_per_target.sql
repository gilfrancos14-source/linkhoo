-- Migration : index unique partiel pour empêcher les checkouts ouverts concurrents
--
-- Contexte :
--   `createCheckout` (payments/service/checkout.ts) appelle `findReusablePayment`
--   puis insère une ligne `payments`. Entre les deux, il y a une fenêtre de
--   course : deux requêtes concurrentes (double-clic, deux onglets, deux
--   retries réseau) peuvent créer DEUX liens de paiement valides pour la même
--   cible → deux débits possibles pour l'utilisateur.
--
--   Ce n'est pas un bug théorique : sur un réseau lent ou un bouton "Payer"
--   qui n'est pas désactivé immédiatement, la probabilité est réelle.
--
-- Solution :
--   Un index UNIQUE PARTIEL sur `payments`. Deux lignes ne peuvent coexister
--   que si elles diffèrent sur (purpose, target, amount_xof) — où "target" est
--   `reservation_id` s'il existe, sinon `gerant_clerk_user_id`.
--
--   Le code applicatif capture `23505` (violation d'unicité) et retourne le
--   paiement gagnant au second appelant (voir `createCheckout`, branche
--   `insertError.code === '23505'`).
--
-- Prédicat `status IN ('created', 'pending', 'requires_action')` :
--   Ces trois statuts correspondent à un checkout encore "ouvert", i.e. que
--   l'utilisateur peut encore payer. Un `succeeded`, `failed`, `canceled`,
--   `expired` ne bloque pas la création d'un nouveau checkout (cas normal :
--   l'utilisateur réessaie après un échec).
--
-- Prédicat `expires_at IS NOT NULL` :
--   Les lignes insérées mais jamais mises à jour (crash entre l'insert et
--   l'écriture du lien provider) ont `expires_at = NULL`. Les inclure dans
--   l'index les ferait bloquer la cible pour toujours. On les exclut : elles
--   ne protègent pas, mais elles ne bloquent pas non plus. Un job de
--   nettoyage les annule (voir "Maintenance" plus bas).
--
--   Note : `expires_at > now()` ne peut PAS figurer dans un prédicat d'index
--   partiel (PostgreSQL exige des expressions IMMUTABLE). On ne peut donc pas
--   exclure dynamiquement les lignes expirées de l'index. Le nettoyage
--   pré-migration + le job périodique couvrent ce cas.

BEGIN;

-- ============================================================================
-- Étape 1 : nettoyer les lignes déjà expirées
-- ============================================================================
-- Sans ça, une ligne `status = 'pending'` avec `expires_at < now()` continuerait
-- à occuper l'index et bloquerait la création d'un nouveau checkout pour la
-- même cible (alors que l'utilisateur ne peut plus payer celle-ci).
UPDATE public.payments
SET status = 'expired',
    updated_at = now()
WHERE status IN ('created', 'pending', 'requires_action')
  AND expires_at IS NOT NULL
  AND expires_at < now();

-- ============================================================================
-- Étape 2 : dédupliquer les checkouts concurrents déjà présents
-- ============================================================================
-- Défensif : si la migration est appliquée sur une base qui a déjà subi le bug
-- (deux `payments` ouverts pour la même cible), la création de l'index
-- échouerait. On garde le plus récent (celui que l'utilisateur voit en
-- dernier) et on annule les autres.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY
             purpose,
             COALESCE(reservation_id::text, gerant_clerk_user_id),
             amount_xof
           ORDER BY created_at DESC
         ) AS rn
  FROM public.payments
  WHERE status IN ('created', 'pending', 'requires_action')
    AND expires_at IS NOT NULL
    AND expires_at > now()
    AND COALESCE(reservation_id::text, gerant_clerk_user_id) IS NOT NULL
)
UPDATE public.payments p
SET status = 'canceled',
    updated_at = now(),
    failure_code = 'pre_migration_dedupe',
    failure_message = 'Doublon annulé avant création de l''index unique'
FROM ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

-- ============================================================================
-- Étape 3 : créer l'index unique
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_open_per_target
  ON public.payments (
    purpose,
    COALESCE(reservation_id::text, gerant_clerk_user_id),
    amount_xof
  )
  WHERE status IN ('created', 'pending', 'requires_action')
    AND expires_at IS NOT NULL;

-- ============================================================================
-- Étape 4 : vérifier
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'payments'
    AND indexname = 'payments_one_open_per_target';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Index payments_one_open_per_target absent après migration';
  END IF;

  RAISE NOTICE 'Migration OK — index payments_one_open_per_target créé';
END $$;

COMMIT;