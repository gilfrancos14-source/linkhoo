-- Empêche deux checkouts ouverts pour la même cible (réservation ou gérant).
-- La cible est `reservation_id` quand il existe, sinon `gerant_clerk_user_id`.
-- `amount_xof` dans la clé garantit qu'un changement de prix crée bien un
-- nouveau checkout (comportement attendu).
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_open_per_target
  ON public.payments (
    purpose,
    COALESCE(reservation_id::text, gerant_clerk_user_id),
    amount_xof
  )
  WHERE status IN ('created', 'pending', 'requires_action');