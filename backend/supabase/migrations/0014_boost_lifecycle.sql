-- Migration : cycle de vie des campagnes Boost — revue du commit a3e5e50.
--
-- Quatre correctifs, tous pilotés par REVUE_BOOST.md :
--   1. M1 — une campagne dont la fenêtre est passée ne reste plus `active` :
--      ajoute le statut `ended` au CHECK, backfill des lignes périmées, et
--      expiration paresseuse dans charge_boost (un événement arrivant après
--      `ends_at` fait passer la campagne à `ended` au lieu de la bloquer).
--      Sans `ended` au CHECK, aucun UPDATE ne peut jamais l'écrire : la
--      chambre reste verrouillée à « Une campagne est déjà en cours ».
--   2. m4 — `clicks_count`/`impressions_count` n'incrémentent plus quand
--      l'événement n'est pas facturé (dédup ou montant 0) : compteurs bruts
--      ≠ événements facturés dans le reporting gérant.
--   3. m10 — un événement à montant 0 (impression CPC, clic CPI) est lu sans
--      verrou `FOR UPDATE` : pas de sérialisation inutile de la landing.
--   4. M4 — `notifications.type` accepte `boost_paid_without_campaign` :
--      paiement encaissé alors que la campagne n'existe plus (supersede /
--      suppression de la chambre) → alerte support au lieu d'un simple
--      console.warn côté webhook.
--
-- Idempotent : DROP IF EXISTS + ADD CONSTRAINT, CREATE OR REPLACE FUNCTION,
-- UPDATE borné. Exécuter via le SQL Editor ou `npm run migrate -- --yes`
-- (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. Statut 'ended' sur boosts
-- ============================================================
-- Le CHECK porte son nom auto-généré `boosts_status_check` (colonne + CHECK
-- inline de 0013). NOT VALID d'abord : verrou ACCESS EXCLUSIVE court sur la
-- table, puis VALIDATE sans bloquer les écritures concurrentes (motif 0012).
ALTER TABLE boosts DROP CONSTRAINT IF EXISTS boosts_status_check;
ALTER TABLE boosts ADD CONSTRAINT boosts_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'exhausted', 'canceled', 'ended'))
  NOT VALID;
ALTER TABLE boosts VALIDATE CONSTRAINT boosts_status_check;

-- ============================================================
-- 2. Backfill : campagnes déjà terminées restées 'active'
-- ============================================================
-- Produit du bug M1 (aucune transition automatique) : sans ce rattrapage, les
-- campagnes anciennes garderaient `status='active'` jusqu'à leur prochain
-- événement de tracking.
UPDATE boosts
   SET status = 'ended',
       updated_at = now()
 WHERE status = 'active'
   AND ends_at <= now();

-- ============================================================
-- 3. notifications.type : + 'boost_paid_without_campaign'
-- ============================================================
-- Liste identique à 0002_historique.sql, à laquelle s'ajoute le nouveau type.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('reservation', 'reservation_confirmed', 'reservation_rejected', 'verification_submitted', 'verification_approved', 'verification_rejected', 'reservation_cancelled', 'boost_paid_without_campaign'));

-- ============================================================
-- 4. charge_boost : expiration paresseuse, compteurs facturés, montant 0
-- ============================================================
-- Voir l'en-tête. La signature et les retours (counted, billed, exhausted,
-- remaining) sont inchangés : routes/boosts.ts et scripts/testBoostRpcs.mjs
-- restent compatibles.
CREATE OR REPLACE FUNCTION public.charge_boost(
  p_boost_id UUID,
  p_kind TEXT,
  p_visitor_id TEXT,
  p_amount INTEGER
)
RETURNS TABLE (counted BOOLEAN, billed BOOLEAN, exhausted BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_status TEXT;
  v_budget INTEGER;
  v_spent INTEGER;
  v_starts TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
  v_last TIMESTAMPTZ;
  v_window INTERVAL;
  v_charge INTEGER;
BEGIN
  IF p_kind NOT IN ('click', 'impression')
     OR p_amount IS NULL OR p_amount < 0
     OR p_visitor_id IS NULL OR length(p_visitor_id) < 8 THEN
    RETURN QUERY SELECT false, false, false, NULL::INTEGER;
    RETURN;
  END IF;

  -- m10 : montant 0 = jamais facturé (impression CPC, clic CPI) → lecture
  -- sans verrou pour ne pas sérialiser les appels de la landing en rafale.
  IF p_amount = 0 THEN
    SELECT b.status, b.budget_total, b.spent, b.starts_at, b.ends_at
      INTO v_status, v_budget, v_spent, v_starts, v_ends
      FROM public.boosts b
     WHERE b.id = p_boost_id;
  ELSE
    SELECT b.status, b.budget_total, b.spent, b.starts_at, b.ends_at
      INTO v_status, v_budget, v_spent, v_starts, v_ends
      FROM public.boosts b
     WHERE b.id = p_boost_id
       FOR UPDATE OF b;
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, NULL::INTEGER;
    RETURN;
  END IF;

  -- M1 : fin de campagne paresseuse. Une impression servie depuis une page
  -- en cache après la date de fin fait passer la campagne à `ended`, ce qui
  -- libère l'unique partielle uq_boosts_room_live.
  IF v_status = 'active' AND v_now > v_ends THEN
    UPDATE public.boosts
       SET status = 'ended',
           updated_at = v_now
     WHERE id = p_boost_id
       AND status = 'active';
    RETURN QUERY SELECT false, false, false, GREATEST(v_budget - v_spent, 0);
    RETURN;
  END IF;

  -- Fenêtre + statut : rien ne se facture hors période.
  IF v_status <> 'active' OR v_now < v_starts OR v_now > v_ends THEN
    RETURN QUERY
      SELECT false, false, (v_status = 'exhausted'), GREATEST(v_budget - v_spent, 0);
    RETURN;
  END IF;

  v_charge := p_amount;

  -- Dédup (uniquement événements facturables) : clic 24 h, impression 10 min.
  IF v_charge > 0 THEN
    v_window := CASE
      WHEN p_kind = 'click' THEN interval '24 hours'
      ELSE interval '10 minutes'
    END;

    SELECT CASE
             WHEN p_kind = 'click' THEN d.last_click_at
             ELSE d.last_impression_at
           END
      INTO v_last
      FROM public.boost_dedup d
     WHERE d.boost_id = p_boost_id
       AND d.visitor_id = p_visitor_id;

    IF FOUND AND v_last IS NOT NULL AND v_now - v_last < v_window THEN
      v_charge := 0;
    END IF;
  END IF;

  -- Budget insuffisant pour cet événement : fin de campagne, rien n'est
  -- débité.
  IF v_charge > 0 AND v_spent + v_charge > v_budget THEN
    UPDATE public.boosts
       SET status = 'exhausted', updated_at = v_now
     WHERE id = p_boost_id
       AND status = 'active';
    RETURN QUERY SELECT false, false, true, GREATEST(v_budget - v_spent, 0);
    RETURN;
  END IF;

  -- m4/m10 : rien à écrire quand l'événement n'est pas facturé (montant 0 ou
  -- déjà dédupliqué) — les compteurs ne comptent que les événements facturés.
  IF v_charge = 0 THEN
    RETURN QUERY SELECT true, false, false, v_budget - v_spent;
    RETURN;
  END IF;

  UPDATE public.boosts
     SET spent = spent + v_charge,
         events_count = events_count + 1,
         clicks_count = clicks_count + CASE WHEN p_kind = 'click' THEN 1 ELSE 0 END,
         impressions_count = impressions_count + CASE WHEN p_kind = 'impression' THEN 1 ELSE 0 END,
         updated_at = v_now
   WHERE id = p_boost_id;

  INSERT INTO public.boost_dedup (boost_id, visitor_id, last_click_at, last_impression_at)
  VALUES (
    p_boost_id,
    p_visitor_id,
    CASE WHEN p_kind = 'click' THEN v_now END,
    CASE WHEN p_kind = 'impression' THEN v_now END
  )
  ON CONFLICT (boost_id, visitor_id) DO UPDATE SET
    last_click_at = CASE
      WHEN p_kind = 'click' THEN v_now
      ELSE boost_dedup.last_click_at
    END,
    last_impression_at = CASE
      WHEN p_kind = 'impression' THEN v_now
      ELSE boost_dedup.last_impression_at
    END;

  RETURN QUERY SELECT true, true, false, v_budget - (v_spent + v_charge);
  RETURN;
END;
$$;
