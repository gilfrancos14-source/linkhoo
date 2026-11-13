-- 0036 : frais de plateforme sur le remboursement d'une annulation (2 %).
--
-- Règle commerciale (12/11/2026) :
--   - la commission de la plateforme (5 / 10 / 15 % selon le statut du
--     gérant) n'est prélevée que si la réservation n'a PAS été annulée ET
--     que le séjour a bien eu lieu ;
--   - en cas d'annulation, le client est remboursé, mais la plateforme
--     prélève 2 % du montant pour couvrir les frais de transaction et
--     d'encaissement. Le client reçoit donc 98 %.
--
-- Le fee est un paramètre explicite de la RPC : la fonction doit solder la
-- réservation (refunded_amount) avec le montant TOTAL (remboursé au client +
-- frais), tout en n'envoyant au prestataire que la part du client.
--
-- Le frais est conservé dans `policy_snapshot` (jsonb) : il est ainsi
-- comptabilisé avec les remboursements, et un second remboursement ne peut
-- pas le reverser une deuxième fois.

-- L'ancienne signature doit disparaître : PostgreSQL créerait une SURCHARGE
-- (les deux fonctions matchent l'appel nommé), et l'appel deviendrait
-- ambigu (« function payment_request_refund(...) is not unique »).
DROP FUNCTION IF EXISTS public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.payment_request_refund(
  p_payment_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_requested_by TEXT,
  p_reason_details TEXT DEFAULT NULL,
  p_policy_snapshot JSONB DEFAULT '{}'::jsonb,
  p_platform_fee BIGINT DEFAULT 0
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
  v_fee BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'REFUND_INVALID_AMOUNT';
  END IF;

  v_fee := GREATEST(COALESCE(p_platform_fee, 0), 0);

  SELECT * INTO v FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;
  IF v.status <> 'succeeded' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE';
  END IF;

  -- Les frais d'annulation déjà retenus comptent comme remboursés : sinon un
  -- second appel pourrait les reverser au client.
  SELECT
      COALESCE(SUM(r.amount), 0)
      + COALESCE(SUM(COALESCE((r.policy_snapshot ->> 'platform_fee')::BIGINT, 0)), 0)
    INTO v_refunded
    FROM public.payment_refunds r
   WHERE r.payment_id = p_payment_id
     AND r.status IN ('requested', 'processing', 'succeeded', 'manual_required');

  IF v_refunded + p_amount + v_fee > v.amount THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT';
  END IF;

  INSERT INTO public.payment_refunds (
    payment_id, reservation_id, amount, currency, amount_xof,
    reason, reason_details, requested_by, policy_snapshot
  ) VALUES (
    v.id, v.reservation_id, p_amount, v.currency,
    ROUND(p_amount / NULLIF(v.fx_rate, 0))::BIGINT,
    p_reason, p_reason_details, p_requested_by,
    CASE
      WHEN v_fee > 0 THEN COALESCE(p_policy_snapshot, '{}'::jsonb)
        || jsonb_build_object('platform_fee', v_fee)
      ELSE COALESCE(p_policy_snapshot, '{}'::jsonb)
    END
  )
  RETURNING id INTO v_id;

  -- La réservation est soldée sur le montant TOTAL (part client + frais) :
  -- un remboursement partiel à 98 % ne doit pas laisser un reste en
  -- suspens, sinon le back-office proposerait de rembourser les 2 %.
  UPDATE public.reservations
     SET refunded_amount = refunded_amount + p_amount + v_fee,
         payment_status = CASE
           WHEN refunded_amount + p_amount + v_fee >= v.amount THEN 'refunded'
           ELSE 'partially_refunded'
         END
   WHERE id = v.reservation_id;

  RETURN QUERY SELECT v_id, v_refunded, v.amount - v_refunded - p_amount - v_fee;
END;
$$;

-- Signature étendue : les anciens appels (sans frais) restent valides.
REVOKE EXECUTE ON FUNCTION public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_refund(UUID, BIGINT, TEXT, TEXT, TEXT, JSONB, BIGINT)
  TO service_role;
