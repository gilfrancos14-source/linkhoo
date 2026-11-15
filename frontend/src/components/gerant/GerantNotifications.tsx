import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  addClientNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
  type Notification,
} from '../../lib/notifications';
import { checkDateConflict, getReservations, updateReservationStatut } from '../../lib/reservations';

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

interface VerifyState {
  notif: Notification;
  loading: boolean;
  available: boolean | null;
}

interface GerantNotificationsProps {
  /** Affiche « Vérifier » sur les demandes quand le gérant est vérifié. */
  isQualified?: boolean;
  /** `topbar` (chrome admin) ou `dashboard` (en-tête de la maquette maq1). */
  variant?: 'topbar' | 'dashboard';
  /** Classes du conteneur, pour le positionnement (ex. `ml-auto`). */
  className?: string;
}

/**
 * Cloche de notifications du gérant : pastille des non-lues, panneau déroulant
 * et vérification d'une demande de réservation.
 *
 * Partagée entre la topbar de `AdminLayout` et l'en-tête du tableau de bord
 * (qui masque cette topbar) : une seule source pour la liste, les actions et
 * la modale, donc un comportement identique sur les deux écrans.
 */
export default function GerantNotifications({
  isQualified = false,
  variant = 'topbar',
  className = '',
}: GerantNotificationsProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const loadNotifs = useCallback(async () => {
    try {
      const notifs = await getNotifications();
      setNotifications(notifs);
      setUnread(notifs.filter((n) => !n.read).length);
    } catch {
      // silencieux : le polling réessaiera
    }
  }, []);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => clearInterval(interval);
  }, [loadNotifs]);

  // Une navigation referme le panneau (comme dans la topbar admin).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotifClick = (notif: Notification) => {
    void markAsRead(notif.id);
    loadNotifs();
  };

  const handleMarkAllRead = () => {
    void markAllAsRead();
    loadNotifs();
  };

  const handleVerify = async (notif: Notification) => {
    setVerify({ notif, loading: true, available: null });

    try {
      const allRes = await getReservations();
      const reservation = notif.reservationId
        ? allRes.find((r) => r.id === notif.reservationId) ?? null
        : null;

      if (!reservation || !reservation.dateDebut || !reservation.dateFin) {
        setVerify((prev) => (prev ? { ...prev, loading: false, available: false } : null));
        return;
      }
      const conflict = await checkDateConflict(
        reservation.roomId,
        reservation.dateDebut,
        reservation.dateFin,
        reservation.id,
      );
      setVerify((prev) => (prev ? { ...prev, loading: false, available: !conflict.hasConflict } : null));
    } catch (err) {
      console.error('[GerantNotifications] Erreur vérification:', err);
      setVerify((prev) => (prev ? { ...prev, loading: false, available: false } : null));
    }
  };

  const handleConfirmFromPopup = async () => {
    if (!verify) return;
    const notif = verify.notif;
    if (!notif.reservationId) return;
    try {
      await updateReservationStatut(notif.reservationId, 'confirmee');

      await addClientNotification({
        type: 'reservation_confirmed',
        roomTitle: notif.roomTitle,
        roomId: notif.roomId,
        clientEmail: notif.clientEmail,
        message: `Votre réservation pour "${notif.roomTitle}" a été confirmée par l'administrateur.`,
      });
      await markAsRead(notif.id);
    } catch (err) {
      console.error('[GerantNotifications] Erreur confirmation:', err);
    }
    setVerify(null);
    loadNotifs();
  };

  const handleRejectFromPopup = async () => {
    if (!verify) return;
    const notif = verify.notif;
    if (!notif.reservationId) return;
    try {
      await updateReservationStatut(notif.reservationId, 'annulee');
      await addClientNotification({
        type: 'reservation_rejected',
        roomTitle: notif.roomTitle,
        roomId: notif.roomId,
        clientEmail: notif.clientEmail,
        message: `Désolé, "${notif.roomTitle}" n'est pas disponible pour les dates souhaitées.`,
      });
      await markAsRead(notif.id);
    } catch (err) {
      console.error('[GerantNotifications] Erreur rejet:', err);
    }
    setVerify(null);
    loadNotifs();
  };

  const isDashboard = variant === 'dashboard';

  return (
    <>
      <div className={`notif-wrapper ${className}`.trim()} ref={wrapperRef}>
        <button
          type="button"
          className={
            isDashboard
              ? 'relative p-2 text-dash-navy'
              : 'topbar__icon-btn'
          }
          aria-label="Notifications"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <svg
            width={isDashboard ? 24 : 19}
            height={isDashboard ? 24 : 19}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
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
            <span
              className={
                isDashboard
                  ? 'absolute right-0.5 top-0 grid h-4 w-4 place-items-center rounded-full bg-dash-brand text-[10px] font-bold text-white'
                  : 'topbar__badge'
              }
            >
              {unread}
            </span>
          )}
        </button>

        {open && (
          <div className="notif-dropdown">
            <div className="notif-dropdown__head">
              <span>Notifications</span>
              {unread > 0 && (
                <button className="notif-dropdown__mark" onClick={handleMarkAllRead}>
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="notif-dropdown__list">
              {notifications.length === 0 ? (
                <p className="notif-dropdown__empty">Aucune notification</p>
              ) : (
                notifications.map((notif) => {
                  const isVerification =
                    notif.type === 'verification_submitted' ||
                    notif.type === 'verification_approved' ||
                    notif.type === 'verification_rejected';
                  return (
                    <div
                      key={notif.id}
                      className={`notif-item ${!notif.read ? 'notif-item--unread' : ''}`}
                    >
                      <button className="notif-item__main" onClick={() => handleNotifClick(notif)}>
                        <div className="notif-item__icon">
                          {isVerification ? (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <path d="M9 12l2 2 4-4" />
                            </svg>
                          ) : (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                          )}
                        </div>
                        <div className="notif-item__body">
                          <p className="notif-item__text">
                            {isVerification ? (
                              notif.type === 'verification_approved' ? (
                                <>
                                  Votre vérification a été <strong>approuvée</strong>
                                </>
                              ) : notif.type === 'verification_rejected' ? (
                                <>
                                  Votre vérification a été <strong>rejetée</strong>
                                </>
                              ) : (
                                <>
                                  Votre demande de vérification a été <strong>soumise</strong>
                                </>
                              )
                            ) : notif.type === 'reservation_cancelled' ? (
                              <>
                                Réservation <strong>annulée</strong> pour{' '}
                                <strong>{notif.roomTitle}</strong>
                              </>
                            ) : (
                              <>
                                Demande de réservation pour <strong>{notif.roomTitle}</strong>
                              </>
                            )}
                          </p>
                          {notif.type === 'reservation' && (
                            <span className="notif-item__dates">Réservation en attente</span>
                          )}
                          {notif.type === 'reservation_cancelled' && (
                            <span className="notif-item__dates">Annulée par le client</span>
                          )}
                          <span className="notif-item__time">{timeAgo(notif.date)}</span>
                        </div>
                        {!notif.read && <span className="notif-item__dot" />}
                      </button>
                      {isQualified &&
                        notif.type === 'reservation' &&
                        notif.reservationId &&
                        !notif.read && (
                          <div className="notif-item__actions">
                            <button
                              className="notif-action notif-action--verify"
                              onClick={() => handleVerify(notif)}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                              </svg>
                              Vérifier
                            </button>
                          </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {verify && (
        <div className="verify-overlay" onClick={() => !verify.loading && setVerify(null)}>
          <div className="verify-modal" onClick={(event) => event.stopPropagation()}>
            {verify.loading ? (
              <div className="verify-modal__loading">
                <div className="verify-spinner" />
                <p>Vérification de la disponibilité...</p>
                <span className="verify-modal__room">{verify.notif.roomTitle}</span>
              </div>
            ) : verify.available ? (
              <div className="verify-modal__result verify-modal__result--available">
                <div className="verify-modal__icon verify-modal__icon--available">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l3 3 5-5" />
                  </svg>
                </div>
                <h3>Disponible</h3>
                <p>
                  La chambre <strong>{verify.notif.roomTitle}</strong> est disponible pour les
                  dates demandées.
                </p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--confirm" onClick={handleConfirmFromPopup}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                    Disponible — Confirmer
                  </button>
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="verify-modal__result verify-modal__result--unavailable">
                <div className="verify-modal__icon verify-modal__icon--unavailable">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                </div>
                <h3>Non disponible</h3>
                <p>
                  La chambre <strong>{verify.notif.roomTitle}</strong> n&apos;est pas disponible
                  pour les dates demandées.
                </p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--reject" onClick={handleRejectFromPopup}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    Non disponible — Refuser
                  </button>
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
