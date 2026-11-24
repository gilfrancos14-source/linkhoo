-- Notifications client : nouveaux types (décisions gérant, paiements, messages).
--
-- La table ne connaissait que les décisions prises par le super-admin en
-- `reservation_confirmed` / `reservation_rejected`. Le gérant, les paiements
-- pawaPay et la messagerie doivent désormais informer le client via la même
-- table (cloche + bannière de l'espace client).
--
-- Idempotent : la contrainte est recréée, pas modifiée in place.

ALTER TABLE public.client_notifications
  DROP CONSTRAINT IF EXISTS client_notifications_type_check;

ALTER TABLE public.client_notifications
  ADD CONSTRAINT client_notifications_type_check
  CHECK (type IN (
    'reservation_confirmed',
    'reservation_rejected',
    'reservation_cancelled',
    'payment_succeeded',
    'payment_failed',
    'payment_refunded',
    'new_message'
  ));
