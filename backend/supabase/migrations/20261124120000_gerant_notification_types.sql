-- Notifications gérant : nouveaux types.
--
-- Deux événements manquants dans la cloche du gérant :
--   * message_received     : un client écrit dans une conversation ;
--   * payout_retry_started : l'admin relance un reversement en échec.
--
-- La contrainte est recréée (idempotente) en conservant tous les types déjà
-- insérés par les flux réservation / vérification / reversement.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'reservation', 'reservation_confirmed', 'reservation_rejected',
    'verification_submitted', 'verification_approved', 'verification_rejected',
    'reservation_cancelled', 'boost_paid_without_campaign',
    'payout_scheduled', 'payout_details_required', 'payout_details_verified',
    'payout_paid', 'payout_failed',
    'message_received', 'payout_retry_started'
  ));
