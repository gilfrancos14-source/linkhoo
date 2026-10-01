import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Bandeau global de mode hors-ligne : prévient l'utilisateur que la
 * consultation repose sur la dernière visite en cache et que les actions
 * réseau (réservation, newsletter, connexion, paiement) sont indisponibles.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner__dot" aria-hidden="true" />
      Vous êtes hors-ligne — affichage de la dernière visite. Réservation,
      connexion et paiement sont indisponibles.
    </div>
  );
}
