import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from '../lib/api';
import {
  getClientNotifications,
  markClientNotificationAsRead,
  type ClientNotification,
} from '../lib/notifications';

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} j`;
}

/** Cloche de notifications du header de l'espace client. */
export default function ClientNotificationBell() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const enabled = isLoaded && isSignedIn;

  const load = useCallback(async () => {
    setAuthTokenGetter(() => getTokenRef.current());
    try {
      setNotifications(await getClientNotifications());
    } catch {
      // silencieux : le polling réessaiera
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      return;
    }
    void load();
    const id = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  const handleRead = async (notification: ClientNotification) => {
    if (notification.read) return;
    try {
      await markClientNotificationAsRead(notification.id);
    } catch {
      // on met à jour localement même si l'API échoue
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
  };

  const handleMarkAllRead = async () => {
    const unreadNotifications = notifications.filter((n) => !n.read);
    await Promise.all(
      unreadNotifications.map((n) =>
        markClientNotificationAsRead(n.id).catch(() => {}),
      ),
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!enabled) return null;

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="topbar__icon-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.7 21a2 2 0 01-3.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && (
          <span className="topbar__badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__head">
            <span>Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className="notif-dropdown__mark"
                onClick={() => void handleMarkAllRead()}
              >
                Tout marquer lu
              </button>
            )}
          </div>
          <div className="notif-dropdown__list">
            {notifications.length === 0 ? (
              <p className="notif-dropdown__empty">Aucune notification</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                >
                  <button
                    type="button"
                    className="notif-item__main"
                    onClick={() => void handleRead(n)}
                  >
                    <div className="notif-item__icon">
                      {n.type === 'reservation_confirmed' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12l3 3 5-5" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                      )}
                    </div>
                    <div className="notif-item__body">
                      <p className="notif-item__text">
                        {n.type === 'reservation_confirmed' ? (
                          <>Réservation <strong>confirmée</strong> pour <strong>{n.roomTitle}</strong></>
                        ) : (
                          <>Réservation <strong>non disponible</strong> pour <strong>{n.roomTitle}</strong></>
                        )}
                      </p>
                      <span className="notif-item__dates">{n.message}</span>
                      <span className="notif-item__time">{timeAgo(n.date)}</span>
                    </div>
                    {!n.read && <span className="notif-item__dot" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
