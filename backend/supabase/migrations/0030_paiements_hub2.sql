-- Migration : socle de paiement Hub2 (abonnements gérant, réservations
-- client, remboursements, reversements).
--
-- Remplace progressivement FedaPay. Le schéma est ADDITIF : les tables
-- `premium_transactions` et les routes FedaPay existantes restent en place
-- pendant la bascule (voir docs/architecture/PAIEMENTS_HUB2.md, § Migration).
--
-- Principes :
--   1. `payments` est le grand livre unique de TOUS les encaissements
--      (premium, boost, vérification, réservation). Une ligne = un
--      PaymentIntent / PaymentLink Hub2, identifiée par `reference`
--      (= purchaseReference envoyé à Hub2).
--   2. `payment_events` est la boîte de réception des webhooks : l'unicité
--      de (provider, provider_event_id) rend le rejeu inoffensif.
--   3. `payment_refunds` porte les remboursements (total ou partiel via
--      POST /payments-refund/{id}/refund) ; le plafond cumulé est vérifié
--      en SQL, sous verrou, jamais côté client.
--   4. `payment_payouts` porte les reversements aux gérants (PAY-OUT).
--   5. `fx_rates` convertit le prix de référence (XOF) vers la devise
--      réellement débitée par Hub2 (XAF en CEMAC, GNF en Guinée).
--
-- Exécuter via `npm run migrate -- --yes` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. Taux de change — le prix du projet est libellé en XOF
-- ============================================================
-- XAF et XOF partagent la même parité (1 XAF = 1 XOF) : le taux est figé.
-- GNF flotte : la ligne est mise à jour par un job quotidien (ou à la main
-- depuis le back-office). Aucune conversion implicite : si aucun taux n'est
-- disponible pour (XOF, devise), le paiement est refusé plutôt que facturé
-- à un montant inventé.
CREATE TABLE IF NOT EXISTS fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  quote_currency TEXT NOT NULL CHECK (quote_currency ~ '^[A-Z]{3}$'),
  rate NUMERIC(18, 8) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fx_rates_pair_check CHECK (base_currency <> quote_currency)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_effective
  ON fx_rates (base_currency, quote_currency, effective_at DESC);

-- Un seul taux par couple et par instant : rend le seed idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fx_rates_pair_effective
  ON fx_rates (base_currency, quote_currency, effective_at);

-- ============================================================
-- 2. Politique commerciale par marché
-- ============================================================
-- Décisions produit figées :
--   * la plateforme encaisse la TOTALITÉ du séjour (deposit_percent = 100) ;
--   * tout remboursement est TOTAL (100 % de la somme encaissée) ;
--   * la commission est nulle pour le moment (commission_percent = 0).
-- Les colonnes restent paramétrables pour ne pas imposer une migration le
-- jour où l'un de ces choix évolue, mais les valeurs par défaut sont celles
-- validées. `payment_request_refund()` accepte un montant : il sert aux cas
-- exceptionnels (geste commercial, litige) et au plafonnement de sécurité,
-- jamais à appliquer une décote automatique.
CREATE TABLE IF NOT EXISTS payment_policies (
  market TEXT PRIMARY KEY,
  deposit_percent SMALLINT NOT NULL DEFAULT 100 CHECK (deposit_percent BETWEEN 0 AND 100),
  commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (commission_percent BETWEEN 0 AND 50),
  payout_delay_hours SMALLINT NOT NULL DEFAULT 24 CHECK (payout_delay_hours >= 0),
  fees_bearer TEXT NOT NULL DEFAULT 'platform' CHECK (fees_bearer IN ('platform', 'customer', 'gerant')),
  online_payment_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Grand livre des encaissements
-- ============================================================
-- `reference` est la clé d'idempotence de bout en bout : elle est générée
-- par le backend, envoyée à Hub2 comme purchaseReference, puis retrouvée
-- dans chaque webhook. `amount` est le montant réellement débité dans
-- `currency` ; `amount_xof` est la contre-valeur de référence (prix du
-- projet), conservée pour la comptabilité et les remboursements.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL CHECK (reference ~ '^PAY-[A-Z0-9-]{6,40}$'),
  purpose TEXT NOT NULL CHECK (purpose IN ('premium', 'boost', 'verification', 'booking')),
  provider TEXT NOT NULL DEFAULT 'hub2' CHECK (provider IN ('hub2', 'fedapay')),
  provider_payment_link_id TEXT,
  provider_payment_intent_id TEXT,
  provider_payment_id TEXT,
  payer_type TEXT NOT NULL CHECK (payer_type IN ('gerant', 'client')),
  payer_clerk_user_id TEXT,
  gerant_clerk_user_id TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  boost_id UUID REFERENCES boosts(id) ON DELETE SET NULL,
  market TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_xof BIGINT NOT NULL CHECK (amount_xof > 0),
  fx_rate NUMERIC(18, 8) NOT NULL DEFAULT 1 CHECK (fx_rate > 0),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'expired')),
  checkout_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_purpose_status ON payments (purpose, status);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments (reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_gerant ON payments (gerant_clerk_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_provider_intent ON payments (provider_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_pending_expiry ON payments (expires_at)
  WHERE status IN ('created', 'pending', 'requires_action');

-- ============================================================
-- 4. Boîte de réception des webhooks
-- ============================================================
-- Hub2 peut rejouer un événement (timeout > 5 s, incident réseau). L'unicité
-- (provider, provider_event_id) garantit qu'un rejeu ne produit jamais deux
-- fois l'effet métier. `processed_at` reste NULL tant que le traitement
-- asynchrone n'a pas abouti : c'est la file de reprise.
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'hub2' CHECK (provider IN ('hub2', 'fedapay')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  attempts SMALLINT NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_unprocessed
  ON payment_events (received_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events (event_type, received_at DESC);

-- ============================================================
-- 5. Remboursements (total ou partiel)
-- ============================================================
-- `provider_refund_id` = id renvoyé par POST /payments-refund/{id}/refund.
-- `policy_snapshot` fige les règles appliquées au moment de la décision :
-- une modification ultérieure de payment_policies ne réécrit pas l'histoire.
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_xof BIGINT NOT NULL CHECK (amount_xof > 0),
  reason TEXT NOT NULL CHECK (reason IN (
    'client_cancellation', 'gerant_refusal', 'gerant_cancellation',
    'auto_expiry', 'platform_cancellation', 'dispute', 'goodwill', 'other'
  )),
  reason_details TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'succeeded', 'failed', 'manual_required', 'canceled')),
  provider_refund_id TEXT,
  provider_status TEXT,
  requested_by TEXT NOT NULL,
  policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds (payment_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds (status, requested_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_provider
  ON payment_refunds (provider_refund_id) WHERE provider_refund_id IS NOT NULL;

-- ============================================================
-- 6. Reversements aux gérants (PAY-OUT)
-- ============================================================
-- Un reversement par réservation payée. `net_amount` = encaissé - commission
-- - remboursements. Le passage à `paid` est piloté par le webhook
-- transfer.succeeded (ou la réconciliation).
CREATE TABLE IF NOT EXISTS payment_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL CHECK (reference ~ '^OUT-[A-Z0-9-]{6,40}$'),
  reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  gerant_clerk_user_id TEXT NOT NULL,
  market TEXT NOT NULL,
  gross_amount BIGINT NOT NULL CHECK (gross_amount >= 0),
  commission_amount BIGINT NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  refunded_amount BIGINT NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  net_amount BIGINT NOT NULL CHECK (net_amount >= 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider_transfer_id TEXT,
  destination_type TEXT NOT NULL DEFAULT 'mobile_money'
    CHECK (destination_type IN ('mobile_money', 'bank_transfer')),
  destination_phone TEXT,
  destination_bank_code TEXT,
  destination_account_number TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'paid', 'failed', 'canceled')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_payouts_amounts_check
    CHECK (net_amount = gross_amount - commission_amount - refunded_amount)
);

CREATE INDEX IF NOT EXISTS idx_payment_payouts_status_due
  ON payment_payouts (scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_payment_payouts_gerant ON payment_payouts (gerant_clerk_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_payouts_reservation
  ON payment_payouts (reservation_id) WHERE reservation_id IS NOT NULL AND status <> 'canceled';
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_payouts_provider
  ON payment_payouts (provider_transfer_id) WHERE provider_transfer_id IS NOT NULL;

-- ============================================================
-- 7. Réservations : état de paiement (sans toucher à `statut`)
-- ============================================================
-- `statut` reste la décision du gérant (en_attente / confirmee / annulee) :
-- aucun code existant ne casse. `payment_status` porte la vie financière.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN (
    'unpaid', 'pending', 'deposit_paid', 'paid',
    'refund_pending', 'partially_refunded', 'refunded', 'failed'
  ));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refunded_amount BIGINT NOT NULL DEFAULT 0
  CHECK (refunded_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_reservations_payment_status ON reservations (payment_status);
CREATE INDEX IF NOT EXISTS idx_reservations_payment_id ON reservations (payment_id);

-- ============================================================
-- 7 bis. Destinataire des reversements (côté gérant)
-- ============================================================
-- Le gérant déclare où recevoir son argent. Aucun reversement n'est créé
-- tant que ces champs ne sont pas renseignés et `payout_verified_at` non nul.
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_method TEXT
  CHECK (payout_method IN ('mobile_money', 'bank_transfer'));
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_phone TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_bank_code TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_account_number TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_holder_name TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_verified_at TIMESTAMPTZ;

-- ============================================================
-- 8. RLS : service role uniquement (comme premium_transactions / boosts)
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. Claim atomique d'un paiement réussi
-- ============================================================
-- Appelée par le webhook ET par le retour navigateur (polling). Le verrou
-- FOR UPDATE sérialise les deux appels : le second reçoit
-- already_claimed = true et ne rejoue aucune activation.
-- Le montant et la devise sont revérifiés ici : jamais confiance au client.
CREATE OR REPLACE FUNCTION public.payment_claim_succeeded(
  p_reference TEXT,
  p_provider_payment_id TEXT,
  p_amount BIGINT,
  p_currency TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  payment_id UUID,
  purpose TEXT,
  already_claimed BOOLEAN,
  reservation_id TEXT,
  boost_id UUID,
  gerant_clerk_user_id TEXT,
  amount BIGINT,
  currency TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.payments WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF v.status = 'succeeded' THEN
    RETURN QUERY SELECT v.id, v.purpose, true, v.reservation_id, v.boost_id,
                        v.gerant_clerk_user_id, v.amount, v.currency, v.metadata;
    RETURN;
  END IF;

  IF v.status IN ('failed', 'canceled', 'expired') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PAYABLE';
  END IF;

  IF v.amount <> p_amount OR v.currency <> p_currency THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';
  END IF;

  UPDATE public.payments
     SET status = 'succeeded',
         provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
         paid_at = p_paid_at,
         updated_at = now()
   WHERE id = v.id;

  RETURN QUERY SELECT v.id, v.purpose, false, v.reservation_id, v.boost_id,
                      v.gerant_clerk_user_id, v.amount, v.currency, v.metadata;
END;
$$;

-- ============================================================
-- 10. Demande de remboursement plafonnée
-- ============================================================
-- Le plafond est calculé SOUS VERROU sur la ligne payments : deux demandes
-- concurrentes ne peuvent pas rembourser deux fois le même franc. Le
-- remboursement Hub2 est asynchrone : la ligne naît en 'requested', puis
-- passe en 'processing' dès que l'API a renvoyé un id.
CREATE OR REPLACE FUNCTION public.payment_request_refund(
  p_payment_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_requested_by TEXT,
  p_reason_details TEXT DEFAULT NULL,
  p_policy_snapshot JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  refund_id UUID,
  already_refunded BIGINT,
  remaining BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v public.payments%ROWTYPE;
  v_refunded BIGINT;
  v_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'REFUND_INVALID_AMOUNT';
  END IF;

  SELECT * INTO v FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;
  IF v.status <> 'succeeded' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE';
  END IF;

  SELECT COALESCE(SUM(r.amount), 0) INTO v_refunded
    FROM public.payment_refunds r
   WHERE r.payment_id = p_payment_id
     AND r.status IN ('requested', 'processing', 'succeeded', 'manual_required');

  IF v_refunded + p_amount > v.amount THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT';
  END IF;

  INSERT INTO public.payment_refunds (
    payment_id, reservation_id, amount, currency, amount_xof,
    reason, reason_details, requested_by, policy_snapshot
  ) VALUES (
    v.id, v.reservation_id, p_amount, v.currency,
    ROUND(p_amount / NULLIF(v.fx_rate, 0))::BIGINT,
    p_reason, p_reason_details, p_requested_by, p_policy_snapshot
  )
  RETURNING id INTO v_id;

  UPDATE public.reservations
     SET refunded_amount = refunded_amount + p_amount,
         payment_status = CASE
           WHEN refunded_amount + p_amount >= v.amount THEN 'refunded'
           ELSE 'partially_refunded'
         END
   WHERE id = v.reservation_id;

  RETURN QUERY SELECT v_id, v_refunded, v.amount - v_refunded - p_amount;
END;
$$;

-- ============================================================
-- 11. Politiques par défaut des 12 marchés
-- ============================================================
-- `online_payment_enabled` reste false là où Hub2 n'expose aucun opérateur
-- (NE, CD) : le front affiche « paiement en ligne bientôt disponible » et
-- la réservation suit le circuit actuel (paiement direct au gérant).
INSERT INTO public.payment_policies (market, online_payment_enabled)
VALUES
  ('CI', true), ('BJ', true), ('SN', true), ('TG', true),
  ('CM', true), ('BF', true), ('CG', true), ('GA', true),
  ('GN', true), ('ML', true), ('NE', false), ('CD', false)
ON CONFLICT (market) DO NOTHING;

-- Parité fixe XAF/XOF (1 pour 1). GNF : taux de départ indicatif, à
-- remplacer par le taux du jour avant la mise en production.
INSERT INTO public.fx_rates (base_currency, quote_currency, rate, source, effective_at)
VALUES
  ('XOF', 'XAF', 1, 'fixed_parity', '2026-01-01T00:00:00Z'),
  ('XOF', 'GNF', 14.7, 'manual_seed', '2026-01-01T00:00:00Z')
ON CONFLICT (base_currency, quote_currency, effective_at) DO NOTHING;
