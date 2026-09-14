import { useState, useEffect } from 'react';
import { getClientNotifications, markClientNotificationAsRead, type ClientNotification } from '../lib/notifications';

export default function ClientNotificationBanner() {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const email = localStorage.getItem('ilehya-client-email');
    if (email) {
      setNotifications(getClientNotifications(email).filter((n) => !n.read && !dismissed.includes(n.id)));
    }
  }, [dismissed]);

  const handleDismiss = (notif: ClientNotification) => {
    const email = localStorage.getItem('ilehya-client-email');
    if (email) {
      markClientNotificationAsRead(notif.id, email);
    }
    setDismissed((prev) => [...prev, notif.id]);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="client-notif-container">
      {notifications.map((n) => (
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
