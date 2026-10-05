-- P1 #8 — Rotation des notifications (rapport 7.2)
--
-- `notifications` et `client_notifications` croissaient sans fin, ralentissant
-- les lectures (cloches, dropdowns, compteurs) à chaque mois de service.
-- `purge_old_notifications()` supprime les lignes plus vieilles que la durée
-- de rétention (30 jours par défaut) ; le backend l'appelle une fois par jour
-- (src/utils/notificationPurge.ts) et elle reste appelable à la main :
--   SELECT * FROM purge_old_notifications(30);
--
-- Idempotent : index CREATE INDEX IF NOT EXISTS + CREATE OR REPLACE FUNCTION,
-- donc réexécutable via `npm run migrate`.

CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(date);
CREATE INDEX IF NOT EXISTS idx_client_notifications_date ON client_notifications(date);

CREATE OR REPLACE FUNCTION purge_old_notifications(p_retention_days integer DEFAULT 30)
RETURNS TABLE (notifications_deleted bigint, client_notifications_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_retention_days < 1 THEN
    RAISE EXCEPTION 'p_retention_days doit être >= 1';
  END IF;

  RETURN QUERY
  WITH deleted_notifications AS (
    DELETE FROM notifications
    WHERE date < now() - make_interval(days => p_retention_days)
    RETURNING 1
  ),
  deleted_client_notifications AS (
    DELETE FROM client_notifications
    WHERE date < now() - make_interval(days => p_retention_days)
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM deleted_notifications)::bigint,
    (SELECT count(*) FROM deleted_client_notifications)::bigint;
END;
$$;

-- La purge ne concerne que le service backend (clé service) : ni anon ni
-- authenticated ne doivent pouvoir appeler cette fonction destructrice.
REVOKE ALL ON FUNCTION purge_old_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_old_notifications(integer) TO service_role;
