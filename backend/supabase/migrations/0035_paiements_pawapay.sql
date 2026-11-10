-- Migration pour ajouter le support de pawaPay
--
-- Points d'attention :
--   * `payments.provider` existe déjà (TEXT, 0030) avec une contrainte
--     `CHECK (provider IN ('hub2','fedapay'))`. On ne peut pas le ré-ajouter :
--     il faut supprimer l'ancienne contrainte et en poser une nouvelle qui
--     autorise 'pawapay'.
--   * Les colonnes de statut sont en TEXT (pas enum) pour rester simples et
--     éviter les dépendances d'ordre de création de types.
--   * Chaque instruction est idempotente (`IF NOT EXISTS`, `DROP IF EXISTS`).

-- ============================================================
-- 1. Autoriser 'pawapay' dans la contrainte du provider
-- ============================================================
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check CHECK (provider IN ('hub2', 'fedapay', 'pawapay'));

-- ============================================================
-- 2. Colonnes spécifiques à pawaPay
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_checkout_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_deposit_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_refund_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_payout_id UUID;

-- Index pour les IDs pawaPay
CREATE INDEX IF NOT EXISTS idx_payments_pawapay_checkout_id ON payments(pawapay_checkout_id);
CREATE INDEX IF NOT EXISTS idx_payments_pawapay_deposit_id ON payments(pawapay_deposit_id);
CREATE INDEX IF NOT EXISTS idx_payments_pawapay_refund_id ON payments(pawapay_refund_id);
CREATE INDEX IF NOT EXISTS idx_payments_pawapay_payout_id ON payments(pawapay_payout_id);

-- ============================================================
-- 3. Statut et raison d'échec pawaPay (TEXT)
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pawapay_metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- 4. Table des marchés pawaPay
-- ============================================================
CREATE TABLE IF NOT EXISTS pawapay_markets (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(3) NOT NULL UNIQUE,
  currency VARCHAR(3) NOT NULL,
  provider_code VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_amount INTEGER NOT NULL,
  max_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. Table des webhooks pawaPay (journal de réception)
-- ============================================================
CREATE TABLE IF NOT EXISTS pawapay_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  signature_input TEXT,
  processed_at TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pawapay_webhooks_event_type ON pawapay_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_pawapay_webhooks_status ON pawapay_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_pawapay_webhooks_created_at ON pawapay_webhooks(created_at);

-- ============================================================
-- 6. Marchés activés
-- ============================================================
INSERT INTO pawapay_markets (country_code, currency, provider_code, is_active, min_amount, max_amount) VALUES
-- Côte d'Ivoire
('CIV', 'XOF', 'MTN_MOMO_CIV', true, 500, 500000),
('CIV', 'XOF', 'ORANGE_CIV', true, 500, 500000),
('CIV', 'XOF', 'WAVE_CIV', true, 500, 500000),
-- Bénin
('BEN', 'XOF', 'MTN_MOMO_BEN', true, 500, 500000),
('BEN', 'XOF', 'MOOV_BEN', true, 500, 500000),
-- Sénégal
('SEN', 'XOF', 'FREE_SEN', true, 500, 500000),
('SEN', 'XOF', 'ORANGE_SEN', true, 500, 500000),
('SEN', 'XOF', 'WAVE_SEN', true, 500, 500000),
-- Cameroun
('CMR', 'XAF', 'MTN_MOMO_CMR', true, 500, 500000),
('CMR', 'XAF', 'ORANGE_CMR', true, 500, 500000),
-- Burkina Faso
('BFA', 'XOF', 'MOOV_BFA', true, 500, 500000),
('BFA', 'XOF', 'ORANGE_BFA', true, 500, 500000),
-- Congo Brazzaville
('COG', 'XAF', 'AIRTEL_COG', true, 500, 500000),
('COG', 'XAF', 'MTN_MOMO_COG', true, 500, 500000),
-- Gabon
('GAB', 'XAF', 'AIRTEL_GAB', true, 500, 500000),
('GAB', 'XAF', 'MTN_MOMO_GAB', true, 500, 500000)
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================
-- 7. Marchés désactivés (pas d'opérateur / décision produit)
-- ============================================================
INSERT INTO pawapay_markets (country_code, currency, provider_code, is_active, min_amount, max_amount) VALUES
('TGO', 'XOF', 'MTN_MOMO_TGO', false, 500, 500000),
('GIN', 'GNF', 'MTN_MOMO_GIN', false, 500, 500000),
('MLI', 'XOF', 'MTN_MOMO_MLI', false, 500, 500000),
('NER', 'XOF', 'MTN_MOMO_NER', false, 500, 500000),
('COD', 'XOF', 'COD_PAYMENT', false, 500, 500000)
ON CONFLICT (country_code) DO NOTHING;
