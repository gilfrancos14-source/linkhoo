-- ============================================================
-- 0036 — Portefeuille gérant et demandes de retrait
-- ============================================================
-- Modèle produit :
--   * un séjour CONFIRMÉ, PAYÉ et TERMINÉ (date_fin passée) crédite le
--     portefeuille du gérant de son net (encaissé - commission - remboursé) ;
--   * un séjour annulé ou remboursé ne crédite rien ;
--   * le gérant demande ensuite un retrait ; c'est ce retrait qui déclenche
--     le payout pawaPay (mobile money).
--
-- `payment_payouts` porte déjà l'historique des versements. On y ajoute un
-- discriminant pour distinguer un versement automatique historique d'une
-- demande de retrait explicite, sans casser les lignes existantes.
--
-- Idempotent : exécutable via `npm run migrate -- --yes`.

-- ============================================================
-- 1. Nature du payout
-- ============================================================
ALTER TABLE payment_payouts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'reservation';
ALTER TABLE payment_payouts DROP CONSTRAINT IF EXISTS payment_payouts_kind_check;
ALTER TABLE payment_payouts ADD CONSTRAINT payment_payouts_kind_check
  CHECK (kind IN ('reservation', 'withdrawal'));

ALTER TABLE payment_payouts ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;

-- ============================================================
-- 2. Une seule demande de retrait active par gérant
-- ============================================================
-- Empêche deux clics concurrents de créer deux retraits du même solde.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_payouts_active_withdrawal
  ON payment_payouts (gerant_clerk_user_id)
  WHERE kind = 'withdrawal' AND status IN ('scheduled', 'processing');

-- ============================================================
-- 3. Sélection des séjours terminés (portefeuille)
-- ============================================================
-- Le solde se calcule sur les séjours dont la date de fin est passée.
CREATE INDEX IF NOT EXISTS idx_reservations_payout_completed
  ON reservations (date_fin)
  WHERE statut = 'confirmee' AND payment_status = 'paid';

-- ============================================================
-- 4. Journal de retraits côté gérant
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payment_payouts_gerant_kind
  ON payment_payouts (gerant_clerk_user_id, kind, created_at DESC);
