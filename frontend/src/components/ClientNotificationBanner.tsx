import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from '../lib/api';
import { getClientNotifications, markClientNotificationAsRead, type ClientNotification } from '../lib/notifications';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

const POLL_INTERVAL_MS = 30_000;

export default function ClientNotificationBanner() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const enabled = clerkConfigured && isLoaded && isSignedIn;

  const load = useCallback(async () => {
    setAuthTokenGetter(() => getToken());
    try {
      const notifs = await getClientNotifications();
      setNotifications(notifs.filter((n) => !n.read));
    } catch {
      // silencieux : le polling réessaiera
    }
  }, [getToken]);

  // Chargement puis polling : sans ça, une notification créée après le montage
  // (ex: réservation confirmée pendant la visite) n'apparaît jamais.
  // `dismissed` reste hors dépendances pour ne pas relancer l'appel à la fermeture.
  useEffect(() => {
    if (!enabled) return;
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  const handleDismiss = async (notif: ClientNotification) => {
    try {
      await markClientNotificationAsRead(notif.id);
    } catch {
      // Fermeture locale même si l'API échoue
    }
    setDismissed((prev) => [...prev, notif.id]);
  };

  if (!enabled) return null;

  const visible = notifications.filter((n) => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="client-notif-container">
      {visible.map((n) => (
        <div key={n.id} className={`client-notif client-notif--${n.type === 'reservation_confirmed' ? 'success' : 'error'}`}>
          <div className="client-notif__icon">
            {n.type === 'reservation_confirmed' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            )}
          </div>
          <div className="client-notif__body">
            <p className="client-notif__title">
              {n.type === 'reservation_confirmed' ? 'Réservation confirmée' : 'Réservation non disponible'}
            </p>
            <p className="client-notif__text">{n.message}</p>
          </div>
          <button className="client-notif__close" onClick={() => handleDismiss(n)} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
