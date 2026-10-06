-- Migration : fonctionnalité « Boost » — sponsorisation de chambres sur la
-- page landing (après la grille des pays).
--
-- Un gérant vérifié paie un budget (1 000 / 3 000 / 5 000 F XOF) pour
-- afficher l'une de ses chambres dans les 6 emplacements « Sponsorisé » de
-- la landing, sur une fenêtre de dates qu'il choisit (max 90 jours). Deux
-- modes de facturation, constants serveur (routes/boosts.ts) :
--   - 'cpc' : 50 F par clic unique (1× par visiteur, campagne, 24 h) ;
--   - 'cpi' : 5 F par impression (1× par visiteur, campagne, 10 min).
-- Le budget ne se consomme QUE dans [starts_at, ends_at] ; la campagne
-- s'arrête à la première arrivée entre la date de fin et l'épuisement.
--
-- Trois pièces maîtresses :
--   1. activate_boost_checked() : claim atomique de la transaction
--      (activated_at NULL → now), miroir de activate_premium_checked — le
--      webhook FedaPay (prioritaire) et la page de retour du gérant
--      (secours) ne crédite JAMAIS le budget deux fois ;
--   2. charge_boost() : verrou ligne + fenêtre + dédup visiteur + débit
--      dans UNE transaction SQL — le budget ne peut pas être dépassé sous
--      concurrence, ni facturer hors période ;
--   3. index partiel UNIQUE : une seule campagne pending/active par chambre.
--
-- premium_transactions.type s'élargit à 'boost' (motif NOT VALID + VALIDATE
-- de 0012 : verrou ACCESS EXCLUSIVE court, validation sans bloquer les
-- écritures) : le ledger FedaPay existant reste la source d'audit.
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate -- --yes` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. Table boosts : une ligne = une campagne sponsorisée
-- ============================================================
-- Pas de colonne « fin calculée » : l'état affiché (programmée / en ligne /
-- terminée) est dérivé à la lecture depuis starts_at/ends_at — aucun job de
-- fond, contrairement à l'expiration paresseuse du premium.
CREATE TABLE IF NOT EXISTS boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market TEXT CHECK (market IN ('CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD')) NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  gerant_id TEXT NOT NULL REFERENCES gerants(clerk_user_id) ON DELETE CASCADE,
  mode TEXT CHECK (mode IN ('cpc', 'cpi')) NOT NULL,
  budget_total INTEGER NOT NULL CHECK (budget_total > 0),
  spent INTEGER NOT NULL DEFAULT 0 CHECK (spent >= 0),
  events_count INTEGER NOT NULL DEFAULT 0 CHECK (events_count >= 0),
  impressions_count INTEGER NOT NULL DEFAULT 0 CHECK (impressions_count >= 0),
  clicks_count INTEGER NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  status TEXT CHECK (status IN ('pending', 'active', 'paused', 'exhausted', 'canceled')) NOT NULL DEFAULT 'pending',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  transaction_id UUID REFERENCES premium_transactions(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT boosts_window_check CHECK (ends_at > starts_at)
);

-- ============================================================
-- 2. Dédup visiteur : clic facturé 1×/24 h, impression 1×/10 min
-- ============================================================
-- Sans cela, un concurrent pourrait vider le budget d'un gérant en
-- bombardant les endpoints de tracking. Une ligne par (campagne, visiteur) ;
-- le verrou de charge_boost sur la ligne boosts sérialise déjà les accès.
CREATE TABLE IF NOT EXISTS boost_dedup (
  boost_id UUID NOT NULL REFERENCES boosts(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  last_click_at TIMESTAMPTZ,
  last_impression_at TIMESTAMPTZ,
  PRIMARY KEY (boost_id, visitor_id)
);

-- ============================================================
-- 3. Index
-- ============================================================
-- Une seule campagne en cours (pending = payée en attente d'activation,
-- active = payée) par chambre. Les campagnes terminées/annulées ne
-- bloquent pas une nouvelle mise en avant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_boosts_room_live
  ON boosts(room_id) WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_boosts_status_market ON boosts(status, market);
CREATE INDEX IF NOT EXISTS idx_boosts_gerant ON boosts(gerant_id);
CREATE INDEX IF NOT EXISTS idx_boosts_transaction ON boosts(transaction_id);

-- ============================================================
-- 4. RLS : aucune policy — seul le service role (backend) lit/écrit,
--    exactement comme premium_transactions.
-- ============================================================
ALTER TABLE boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE boost_dedup ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. premium_transactions.type : 'premium' | 'verification' → + 'boost'
-- ============================================================
ALTER TABLE premium_transactions DROP CONSTRAINT IF EXISTS premium_transactions_type_check;
ALTER TABLE premium_transactions ADD CONSTRAINT premium_transactions_type_check
  CHECK (type IN ('premium', 'verification', 'boost')) NOT VALID;
ALTER TABLE premium_transactions VALIDATE CONSTRAINT premium_transactions_type_check;

-- ============================================================
-- 6. Activation atomique d'une campagne (anti double-crédit)
-- ============================================================
-- Le webhook FedaPay ET POST /api/boosts/confirm arrivent presque en même
-- temps : le claim sur activated_at garantit qu'un seul crédite la
-- campagne, l'autre constate already_activated = true. Un claim sans ligne
-- boosts correspondante (transaction non-boost) annule TOUT (RAISE →
-- rollback du claim) plutôt que de consommer un paiement sans livrer.
CREATE OR REPLACE FUNCTION public.activate_boost_checked(
  p_transaction_id UUID
)
RETURNS TABLE (already_activated BOOLEAN, boost_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_boost UUID;
BEGIN
  -- 1. Verrou atomique : un seul appelant fait passer activated_at
  --    de NULL à une date. FOUND = false => déjà consommée.
  UPDATE public.premium_transactions
     SET activated_at = now(), updated_at = now()
   WHERE id = p_transaction_id
     AND activated_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT true, b.id
        FROM public.boosts b
       WHERE b.transaction_id = p_transaction_id;
    RETURN;
  END IF;

  -- 2. pending → active : la campagne démarre (ou sera « programmée »
  --    si sa fenêtre commence plus tard — l'affichage dérive de la date).
  UPDATE public.boosts
     SET status = 'active',
         activated_at = now(),
         updated_at = now()
   WHERE transaction_id = p_transaction_id
     AND status = 'pending'
   RETURNING id INTO v_boost;

  IF v_boost IS NULL THEN
    RAISE EXCEPTION 'BOOST_NOT_FOUND';
  END IF;

  RETURN QUERY SELECT false, v_boost;
END;
$$;

-- ============================================================
-- 7. Facturation atomique d'un événement de tracking
-- ============================================================
-- p_amount est calculé côté serveur (routes/boosts.ts) d'après le mode de
-- la campagne — jamais par le client. Retourne (counted, billed,
-- exhausted, remaining) :
--   - hors fenêtre / campagne non active : rien ne se facture ;
--   - événement déjà facturé pour ce visiteur (dédup) : compté, gratuit ;
--   - budget insuffisant : la campagne passe à 'exhausted' sur place.
-- Le verrou FOR UPDATE sur la ligne boosts sérialise les appels
-- concurrents : deux clics simultanés ne dépassent jamais le budget.
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

  SELECT b.status, b.budget_total, b.spent, b.starts_at, b.ends_at
    INTO v_status, v_budget, v_spent, v_starts, v_ends
    FROM public.boosts b
   WHERE b.id = p_boost_id
     FOR UPDATE OF b;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, NULL::INTEGER;
    RETURN;
  END IF;

  -- Fenêtre + statut : une impression sur une page en cache après la date
  -- de fin ne débite jamais le budget.
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
  -- débité (les compteurs bruts restent tels quels).
  IF v_charge > 0 AND v_spent + v_charge > v_budget THEN
    UPDATE public.boosts
       SET status = 'exhausted', updated_at = v_now
     WHERE id = p_boost_id
       AND status = 'active';
    RETURN QUERY SELECT false, false, true, GREATEST(v_budget - v_spent, 0);
    RETURN;
  END IF;

  UPDATE public.boosts
     SET spent = spent + v_charge,
         events_count = events_count + CASE WHEN v_charge > 0 THEN 1 ELSE 0 END,
         clicks_count = clicks_count + CASE WHEN p_kind = 'click' THEN 1 ELSE 0 END,
         impressions_count = impressions_count + CASE WHEN p_kind = 'impression' THEN 1 ELSE 0 END,
         updated_at = v_now
   WHERE id = p_boost_id;

  IF v_charge > 0 THEN
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
  END IF;

  RETURN QUERY SELECT true, (v_charge > 0), false, v_budget - (v_spent + v_charge);
  RETURN;
END;
$$;
