-- ============================================================
-- 0033 — Reversements aux gérants (phase 4)
-- ============================================================
-- Complète le socle de 0030, qui créait déjà `payment_payouts` et les
-- colonnes `payout_*` de `gerants`. Trois manques y subsistaient :
--
--   1. Hub2 exige un opérateur (`orange`, `mtn`, …) pour un transfert
--      mobile money ; aucune colonne ne le stockait.
--   2. Un transfert bancaire exige aussi le nom de la banque.
--   3. Le snapshot du destinataire ne conservait pas le nom du titulaire.
--
-- Aucune donnée existante n'est modifiée : les colonnes sont nullables et
-- les reversements ne partent que si `payout_verified_at` est renseigné.
--
-- Exécuter via `npm run migrate -- --yes` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. Coordonnées de reversement du gérant
-- ============================================================
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_provider TEXT;
ALTER TABLE gerants ADD COLUMN IF NOT EXISTS payout_bank_name TEXT;

-- ============================================================
-- 2. Snapshot du destinataire sur le reversement
-- ============================================================
-- Le payout fige la destination au moment de l'envoi : un gérant qui change
-- de numéro ne doit pas réécrire l'historique comptable.
ALTER TABLE payment_payouts ADD COLUMN IF NOT EXISTS destination_holder_name TEXT;
ALTER TABLE payment_payouts ADD COLUMN IF NOT EXISTS destination_provider TEXT;
ALTER TABLE payment_payouts ADD COLUMN IF NOT EXISTS destination_bank_name TEXT;

-- ============================================================
-- 3. Sélection des reversements dus
-- ============================================================
-- Le job interroge les réservations confirmées + payées dont le séjour a
-- commencé. L'index partiel évite de balayer tout l'historique.
CREATE INDEX IF NOT EXISTS idx_reservations_payout_due
  ON reservations (date_debut)
  WHERE statut = 'confirmee' AND payment_status = 'paid';

-- ============================================================
-- 4. Notifications de reversement
-- ============================================================
-- La contrainte date de 0014. On la remplace en conservant tous les types
-- existants, sinon les insertions de réservation/vérification échoueraient.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'reservation', 'reservation_confirmed', 'reservation_rejected',
    'verification_submitted', 'verification_approved', 'verification_rejected',
    'reservation_cancelled', 'boost_paid_without_campaign',
    'payout_scheduled', 'payout_details_required', 'payout_details_verified',
    'payout_paid', 'payout_failed'
  ));
