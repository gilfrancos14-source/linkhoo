import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from '../lib/api';
import { getClientNotifications, markClientNotificationAsRead, type ClientNotification } from '../lib/notifications';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

const POLL_INTERVAL_MS = 30_000;

const TITLES: Record<ClientNotification['type'], string> = {
  reservation_confirmed: 'Réservation confirmée',
  reservation_rejected: 'Réservation non disponible',
  reservation_cancelled: 'Réservation annulée',
  payment_succeeded: 'Paiement confirmé',
  payment_failed: 'Paiement non abouti',
  payment_refunded: 'Remboursement effectué',
  new_message: 'Nouveau message de votre hôte',
};

function tone(type: ClientNotification['type']): 'success' | 'error' | 'info' {
  if (['reservation_confirmed', 'payment_succeeded', 'payment_refunded'].includes(type)) {
    return 'success';
  }
  if (['reservation_rejected', 'reservation_cancelled', 'payment_failed'].includes(type)) {
    return 'error';
  }
  return 'info';
}

function BannerIcon({ type }: { type: ClientNotification['type'] }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tone(type) === 'success') {
    return <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" /></svg>;
  }
  if (tone(type) === 'error') {
    return <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>;
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}

export default function ClientNotificationBanner() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const enabled = clerkConfigured && isLoaded && isSignedIn;

  // `load` reste stable (aucune dépendance) : le jeton est lu via une ref.
  // Sans cela, une identité instable de `getToken` relancerait l'effet à chaque
  // render et `setNotifications(<nouveau tableau>)` provoquerait une boucle de
  // rendu (« Maximum update depth exceeded »). On ne remplace l'état que si la
  // liste des notifications non lues a réellement changé.
  const load = useCallback(async () => {
    setAuthTokenGetter(() => getTokenRef.current());
    try {
      const notifs = await getClientNotifications();
      const unread = notifs.filter((n) => !n.read);
      setNotifications((prev) =>
        prev.length === unread.length && prev.every((p, i) => p.id === unread[i].id)
          ? prev
          : unread,
      );
    } catch {
      // silencieux : le polling réessaiera
    }
  }, []);

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
        <div key={n.id} className={`client-notif client-notif--${tone(n.type)}`}>
          <div className="client-notif__icon">
            <BannerIcon type={n.type} />
          </div>
          <div className="client-notif__body">
            <p className="client-notif__title">{TITLES[n.type]}</p>
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
