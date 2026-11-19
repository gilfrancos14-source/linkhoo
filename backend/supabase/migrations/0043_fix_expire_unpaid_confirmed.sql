-- Migration corrective : expire_unpaid_confirmed_reservations().
--
-- La migration 0040 filtrait sur `payment_status IS NULL`, mais la colonne
-- `payment_status` a pour valeur par defaut 'unpaid' et est NOT NULL : la
-- fonction ne trouvait donc jamais de reservation a annuler.
--
-- On aligne le filtre sur les valeurs reelles utilisees par le backend
-- (voir reservations.ts : .in('payment_status', ['unpaid', 'failed'])).

CREATE OR REPLACE FUNCTION public.expire_unpaid_confirmed_reservations(
  p_payment_timeout_hours INTEGER DEFAULT 24
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.reservations
  SET statut = 'annulee',
      responded_at = now(),
      annulee_reason = 'payment_timeout'
  WHERE statut = 'confirmee'
    AND COALESCE(payment_status, 'unpaid') IN ('unpaid', 'failed')
    AND responded_at < now() - make_interval(hours => greatest(COALESCE(p_payment_timeout_hours, 24), 1));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_unpaid_confirmed_reservations(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_confirmed_reservations(INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';
