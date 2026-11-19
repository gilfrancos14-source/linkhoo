-- ============================================================
-- 0044 — Retenue d'annulation 3 % partagée plateforme / gérant
-- ============================================================
-- Règle commerciale (mise à jour) :
--   - quand le CLIENT annule, la retenue passe de 2 % à 3 % ;
--   - cette retenue est partagée moitié-moitié : 1,5 % pour la plateforme
--     (frais d'encaissement) et 1,5 % pour le gérant (dédommagement des dates
--     bloquées) ;
--   - le client reçoit donc 97 %.
--
-- La part du gérant est enregistrée dans `policy_snapshot` (gerant_fee) et
-- fait l'objet d'un payout dédié immédiat (kind='cancellation_fee') créé par
-- le service de remboursement. Les deux parts sont comptées comme « déjà
-- remboursées » pour empêcher un second remboursement de les reverser.

-- 1. Le payout dédié doit être reconnu par la contrainte de kind.
ALTER TABLE payment_payouts DROP CONSTRAINT IF EXISTS payment_payouts_kind_check;
ALTER TABLE payment_payouts ADD CONSTRAINT payment_payouts_kind_check
  CHECK (kind IN ('reservation', 'withdrawal', 'cancellation_fee'));

-- 2. Étendre la RPC de remboursement avec la part du gérant.
--    Nouvelle signature 8 arguments : on supprime l'ancienne à 7 arguments
--    pour éviter une surcharge ambiguë.
DROP FUNCTION IF EXISTS public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB, BIGINT);

CREATE OR REPLACE FUNCTION public.payment_request_refund(
  p_payment_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_requested_by TEXT,
  p_reason_details TEXT DEFAULT NULL,
  p_policy_snapshot JSONB DEFAULT '{}'::jsonb,
  p_platform_fee BIGINT DEFAULT 0,
  p_gerant_fee BIGINT DEFAULT 0
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
  v_platform_fee BIGINT;
  v_gerant_fee BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'REFUND_INVALID_AMOUNT';
  END IF;

  v_platform_fee := GREATEST(COALESCE(p_platform_fee, 0), 0);
  v_gerant_fee := GREATEST(COALESCE(p_gerant_fee, 0), 0);

  SELECT * INTO v FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;
  IF v.status <> 'succeeded' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE';
  END IF;

  -- Les retenues déjà appliquées comptent comme remboursées : sinon un second
  -- appel pourrait les reverser au client (anti-duplication).
  SELECT
      COALESCE(SUM(r.amount), 0)
      + COALESCE(SUM(COALESCE((r.policy_snapshot ->> 'platform_fee')::BIGINT, 0)), 0)
      + COALESCE(SUM(COALESCE((r.policy_snapshot ->> 'gerant_fee')::BIGINT, 0)), 0)
    INTO v_refunded
    FROM public.payment_refunds r
   WHERE r.payment_id = p_payment_id
     AND r.status IN ('requested', 'processing', 'succeeded', 'manual_required');

  IF v_refunded + p_amount + v_platform_fee + v_gerant_fee > v.amount THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT';
  END IF;

  INSERT INTO public.payment_refunds (
    payment_id, reservation_id, amount, currency, amount_xof,
    reason, reason_details, requested_by, policy_snapshot
  ) VALUES (
    v.id, v.reservation_id, p_amount, v.currency,
    ROUND(p_amount / NULLIF(v.fx_rate, 0))::BIGINT,
    p_reason, p_reason_details, p_requested_by,
    COALESCE(p_policy_snapshot, '{}'::jsonb)
      || CASE WHEN v_platform_fee > 0 THEN jsonb_build_object('platform_fee', v_platform_fee) ELSE '{}'::jsonb END
      || CASE WHEN v_gerant_fee > 0 THEN jsonb_build_object('gerant_fee', v_gerant_fee) ELSE '{}'::jsonb END
  )
  RETURNING id INTO v_id;

  -- La réservation est soldée sur le montant TOTAL (part client + retenues).
  UPDATE public.reservations
     SET refunded_amount = refunded_amount + p_amount + v_platform_fee + v_gerant_fee,
         payment_status = CASE
           WHEN refunded_amount + p_amount + v_platform_fee + v_gerant_fee >= v.amount THEN 'refunded'
           ELSE 'partially_refunded'
         END
   WHERE id = v.reservation_id;

  RETURN QUERY SELECT v_id, v_refunded, v.amount - v_refunded - p_amount - v_platform_fee - v_gerant_fee;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB, BIGINT, BIGINT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
