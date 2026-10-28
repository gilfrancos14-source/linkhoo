-- Migration : paiement des réservations (phase 3).
--
-- Complète le socle 0030 sans le modifier :
--   * `payment_claim_booking` : réclame un encaissement ET marque la
--     réservation payée dans la même transaction (même schéma que
--     `payment_claim_premium` en 0031) ;
--   * `payment_cancel_refund` : annule une demande de remboursement dont le
--     prestataire a refusé l'exécution, en rendant le montant à la
--     réservation (sinon elle resterait « remboursée » sans l'être).
--
-- Rappel des décisions : la plateforme encaisse 100 % du séjour, tout
-- remboursement est total par défaut, la commission est nulle.
--
-- Exécuter via `npm run migrate -- --yes` (pré-vol : `npm run migrate:check`).

-- ============================================================
-- 1. Claim atomique d'une réservation payée
-- ============================================================
-- Appelée par le webhook ET par le retour navigateur. `payment_claim_succeeded`
-- verrouille déjà la ligne `payments` (FOR UPDATE) et vérifie le montant : le
-- second appelant reçoit `already_claimed = true` et ne repasse pas par
-- l'écriture de la réservation.
--
-- `fulfilled_at` reste le témoin d'idempotence du paiement ; `reservations.
-- paid_at` / `payment_status` sont la contrepartie visible côté produit.
CREATE OR REPLACE FUNCTION public.payment_claim_booking(
  p_reference TEXT,
  p_provider_payment_id TEXT,
  p_amount BIGINT,
  p_currency TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  payment_id UUID,
  reservation_id TEXT,
  already_claimed BOOLEAN,
  gerant_clerk_user_id TEXT,
  amount BIGINT,
  currency TEXT,
  market TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id UUID;
  v_purpose TEXT;
  v_already BOOLEAN;
  v_reservation TEXT;
  v_gerant TEXT;
  v_amount BIGINT;
  v_currency TEXT;
  v_market TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Claim générique : verrouille, vérifie montant/devise, passe à
  --    `succeeded`. Lève PAYMENT_NOT_FOUND / PAYMENT_NOT_PAYABLE /
  --    PAYMENT_AMOUNT_MISMATCH.
  SELECT c.payment_id, c.purpose, c.already_claimed, c.reservation_id,
         c.gerant_clerk_user_id, c.amount, c.currency
    INTO v_payment_id, v_purpose, v_already, v_reservation,
         v_gerant, v_amount, v_currency
    FROM public.payment_claim_succeeded(
      p_reference, p_provider_payment_id, p_amount, p_currency, p_paid_at
    ) AS c;

  -- Un paiement premium ne doit jamais marquer une réservation payée : lever
  -- ici annule aussi le claim (la fonction est transactionnelle).
  IF v_purpose <> 'booking' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_BOOKING';
  END IF;
  IF v_reservation IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NO_RESERVATION';
  END IF;

  -- 2. Contrepartie : la réservation devient payée. La garde
  --    `payment_status <> 'paid'` rend l'écriture idempotente même si deux
  --    paiements distincts pointaient par erreur vers la même réservation.
  UPDATE public.reservations r
     SET payment_status = 'paid',
         paid_at = COALESCE(r.paid_at, p_paid_at),
         payment_id = v_payment_id
   WHERE r.id = v_reservation
     AND r.payment_status <> 'paid';

  -- 3. Témoin de livraison, comme pour le premium.
  UPDATE public.payments p
     SET fulfilled_at = COALESCE(p.fulfilled_at, v_now),
         updated_at = v_now
   WHERE p.id = v_payment_id;

  SELECT p.market INTO v_market FROM public.payments p WHERE p.id = v_payment_id;

  RETURN QUERY SELECT v_payment_id, v_reservation, v_already,
                      v_gerant, v_amount, v_currency, v_market;
END;
$$;

-- ============================================================
-- 2. Annulation d'un remboursement refusé
-- ============================================================
-- `payment_request_refund` (0030) réserve le montant et marque la réservation
-- remboursée dès la DEMANDE, sous verrou. Si Hub2 refuse ensuite l'opération
-- (solde insuffisant, opérateur indisponible), il faut rendre ce montant à la
-- réservation : sinon elle resterait « remboursée » alors que l'argent n'est
-- jamais reparti.
--
-- Le statut du remboursement est figé à `failed` ; le recalcul se fait à
-- partir des AUTRES remboursements encore vivants, jamais par soustraction
-- naïve (deux échecs concurrents ne doivent pas rendre deux fois).
CREATE OR REPLACE FUNCTION public.payment_cancel_refund(p_refund_id UUID)
RETURNS TABLE (
  refund_id UUID,
  status TEXT,
  reservation_id TEXT,
  refunded_amount BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v public.payment_refunds%ROWTYPE;
  v_total BIGINT := 0;
  v_payment_amount BIGINT;
BEGIN
  SELECT * INTO v FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_NOT_FOUND';
  END IF;

  -- Un remboursement déjà abouti ne se « dé-rembourse » pas ici : seul un
  -- webhook `refund.failed` postérieur, traité manuellement, le ferait.
  IF v.status = 'succeeded' THEN
    RAISE EXCEPTION 'REFUND_ALREADY_COMPLETED';
  END IF;

  UPDATE public.payment_refunds
     SET status = 'failed',
         completed_at = COALESCE(completed_at, now()),
         updated_at = now()
   WHERE id = v.id;

  IF v.reservation_id IS NOT NULL THEN
    SELECT COALESCE(SUM(r.amount), 0) INTO v_total
      FROM public.payment_refunds r
     WHERE r.payment_id = v.payment_id
       AND r.id <> v.id
       AND r.status IN ('requested', 'processing', 'succeeded', 'manual_required');

    SELECT p.amount INTO v_payment_amount
      FROM public.payments p
     WHERE p.id = v.payment_id;

    UPDATE public.reservations r
       SET refunded_amount = v_total,
           payment_status = CASE
             WHEN v_total <= 0 THEN 'paid'
             WHEN v_total >= v_payment_amount THEN 'refunded'
             ELSE 'partially_refunded'
           END
     WHERE r.id = v.reservation_id;
  END IF;

  RETURN QUERY SELECT v.id, 'failed'::TEXT, v.reservation_id, v_total;
END;
$$;

-- ============================================================
-- 3. Index de reprise / expiration
-- ============================================================
-- Le job d'expiration cherche les réservations dont le checkout est resté
-- ouvert : index partiel, il ne grossit pas avec l'historique.
CREATE INDEX IF NOT EXISTS idx_reservations_pending_payment
  ON reservations (created_at)
  WHERE payment_status = 'pending';

-- ============================================================
-- 4. Droits : RPC internes réservées au service role
-- ============================================================
-- 0030 avait créé ces fonctions sans révoquer les droits par défaut. Elles
-- manipulent de l'argent : aucun client anon/authenticated ne doit pouvoir
-- les appeler directement via PostgREST.
REVOKE EXECUTE ON FUNCTION public.payment_claim_succeeded(TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_claim_succeeded(TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.payment_claim_booking(TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_claim_booking(TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.payment_cancel_refund(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_cancel_refund(UUID)
  TO service_role;
