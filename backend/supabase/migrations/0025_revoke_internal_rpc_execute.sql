-- F1 : les RPC internes ne doivent pas être appelables par `anon` /
-- `authenticated` via PostgREST. Elles sont toutes en SECURITY INVOKER (donc
-- protégées par la RLS), mais l'exposition inutile élargit la surface d'attaque
-- et permettrait notamment de consommer des paiements ou de sonder des données.
-- Seul le backend (service_role) les appelle.
--
-- `admin_stats`, `admin_reservations`, `expire_stale_pending_reservations`,
-- `purge_old_notifications`, `messages_inbox` et `messages_unread_total` sont
-- déjà révoquées dans leurs migrations respectives.

REVOKE EXECUTE ON FUNCTION public.create_reservation_checked(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_reservation_checked(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_reservation_checked(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_reservation_checked(TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_date_conflict(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_date_conflict(TEXT, TEXT, TEXT, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.activate_premium_checked(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_premium_checked(UUID, INTEGER)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.activate_boost_checked(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_boost_checked(UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.charge_boost(UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_boost(UUID, TEXT, TEXT, INTEGER)
  TO service_role;
