-- Migration : activation premium atomique depuis un paiement Hub2.
--
-- `payment_claim_succeeded` (0030) marque un encaissement comme réussi, mais
-- ne crédite aucun produit. Cette migration ajoute le claim « premium » :
-- réclamer le paiement ET prolonger l'abonnement dans la MÊME transaction.
--
-- Sans cette atomicité, un crash entre les deux écritures produirait soit un
-- paiement encaissé sans abonnement, soit un abonnement prolongé deux fois au
-- rejeu du webhook. Le verrou `FOR UPDATE` de `payment_claim_succeeded`
-- sérialise le webhook et le retour navigateur (`/api/premium/confirm`).
--
-- Le comportement de prolongation est identique à `activate_premium_checked`
-- (0002) : si l'abonnement court encore, on ajoute les jours à la date
-- existante ; sinon on repart de maintenant.

CREATE OR REPLACE FUNCTION public.payment_claim_premium(
  p_reference TEXT,
  p_provider_payment_id TEXT,
  p_amount BIGINT,
  p_currency TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  payment_id UUID,
  already_claimed BOOLEAN,
  new_expires_at TIMESTAMPTZ,
  gerant_clerk_user_id TEXT,
  market TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id UUID;
  v_purpose TEXT;
  v_already BOOLEAN;
  v_gerant TEXT;
  v_market TEXT;
  v_fulfilled TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'INVALID_PREMIUM_DURATION';
  END IF;

  -- 1. Claim générique : verrouille la ligne, vérifie montant/devise et passe
  --    le paiement à `succeeded`. Lève PAYMENT_NOT_FOUND / AMOUNT_MISMATCH.
  SELECT c.payment_id, c.purpose, c.already_claimed, c.gerant_clerk_user_id, c.market
    INTO v_payment_id, v_purpose, v_already, v_gerant, v_market
    FROM public.payment_claim_succeeded(
      p_reference, p_provider_payment_id, p_amount, p_currency
    ) AS c;

  -- Un paiement de réservation ne doit jamais créditer un abonnement. Lever
  -- ici annule aussi le claim (la fonction est transactionnelle).
  IF v_purpose <> 'premium' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PREMIUM';
  END IF;

  IF v_gerant IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NO_GERANT';
  END IF;

  SELECT p.fulfilled_at INTO v_fulfilled
    FROM public.payments p
   WHERE p.id = v_payment_id;

  -- Déjà livré : on renvoie l'état courant sans prolonger une seconde fois.
  IF v_already AND v_fulfilled IS NOT NULL THEN
    SELECT g.premium_expires_at INTO v_expires
      FROM public.gerants g
     WHERE g.clerk_user_id = v_gerant;
    RETURN QUERY SELECT v_payment_id, true, v_expires, v_gerant, v_market;
    RETURN;
  END IF;

  -- 2. Prolongation. Une seule instruction : le verrou de ligne rend lecture
  --    et écriture atomiques si deux paiements distincts du même gérant sont
  --    activés simultanément.
  UPDATE public.gerants
     SET is_premium = true,
         premium_expires_at = CASE
           WHEN premium_expires_at IS NOT NULL AND premium_expires_at > v_now
             THEN premium_expires_at + make_interval(days => p_days)
           ELSE v_now + make_interval(days => p_days)
         END,
         updated_at = v_now
   WHERE clerk_user_id = v_gerant
   RETURNING premium_expires_at INTO v_expires;

  -- Gérant disparu : on annule tout plutôt que de consommer le paiement.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GERANT_NOT_FOUND';
  END IF;

  -- 3. Marque la contrepartie comme livrée. `fulfilled_at` est le témoin
  --    d'idempotence : un rejeu ne repasse pas par l'étape 2.
  UPDATE public.payments
     SET fulfilled_at = v_now,
         updated_at = v_now
   WHERE id = v_payment_id;

  RETURN QUERY SELECT v_payment_id, false, v_expires, v_gerant, v_market;
END;
$$;

-- RPC interne : seul le service role (backend) peut l'appeler.
REVOKE EXECUTE ON FUNCTION public.payment_claim_premium(TEXT, TEXT, BIGINT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_claim_premium(TEXT, TEXT, BIGINT, TEXT, INTEGER)
  TO service_role;
