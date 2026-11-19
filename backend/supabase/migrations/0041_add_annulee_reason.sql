-- Migration corrective : ajoute la colonne annulee_reason utilisee par les
-- jobs d'expiration et la migration 0040, mais jamais creee jusqu'ici.
--
-- La migration 0040 reference annulee_reason dans
-- expire_unpaid_confirmed_reservations() sans la creer : sur une base ou la
-- fonction est appelee, cela leve « column annulee_reason does not exist ».
-- On ajoute ici la colonne de maniere idempotente, puis on aligne
-- expire_stale_pending_reservations() pour qu'elle pose la raison attendue
-- par le job (backend/src/jobs/expireStalePending.ts filtre sur 'stale_pending').

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS annulee_reason TEXT;

-- expire_unpaid_confirmed_reservations() pose deja 'payment_timeout' : la
-- colonne existant desormais, la fonction devient valide.

-- expire_stale_pending_reservations() : ajouter la raison 'stale_pending'
CREATE OR REPLACE FUNCTION public.expire_stale_pending_reservations(
  p_ttl_hours INTEGER DEFAULT 24
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
      annulee_reason = 'stale_pending'
  WHERE statut = 'en_attente'
    AND created_at < now() - make_interval(hours => greatest(COALESCE(p_ttl_hours, 24), 1));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_reservations(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_pending_reservations(INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';
