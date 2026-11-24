import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  addClientNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
  type Notification,
} from '../../lib/notifications';
import { checkDateConflict, getReservations, updateReservationStatut } from '../../lib/reservations';
import '../../styles/50-gerant-notifications.css';

type NotifTone = 'reservation' | 'verification' | 'payout' | 'message' | 'cancel';

interface NotifMeta {
  tone: NotifTone;
  label: string;
  /** Segment de l'espace gérant vers lequel pointer l'action « Voir ». */
  path?: string;
}

/** Une seule table de rendu pour tous les types : plus de texte reconstruit
 *  à côté du message envoyé par le backend. */
const NOTIF_META: Record<Notification['type'], NotifMeta> = {
  reservation: { tone: 'reservation', label: 'Réservation en attente', path: 'reservations' },
  reservation_confirmed: { tone: 'reservation', label: 'Réservation confirmée', path: 'reservations' },
  reservation_rejected: { tone: 'reservation', label: 'Réservation refusée', path: 'reservations' },
  reservation_cancelled: { tone: 'cancel', label: 'Annulée par le client', path: 'reservations' },
  verification_submitted: { tone: 'verification', label: 'Vérification du dossier', path: 'verification' },
  verification_approved: { tone: 'verification', label: 'Vérification du dossier', path: 'verification' },
  verification_rejected: { tone: 'verification', label: 'Vérification du dossier', path: 'verification' },
  payout_scheduled: { tone: 'payout', label: 'Reversement', path: 'reversements' },
  payout_details_required: { tone: 'payout', label: 'Coordonnées de paiement', path: 'reversements' },
  payout_details_verified: { tone: 'payout', label: 'Coordonnées de paiement', path: 'reversements' },
  payout_paid: { tone: 'payout', label: 'Reversement versé', path: 'reversements' },
  payout_failed: { tone: 'payout', label: 'Reversement en échec', path: 'reversements' },
  payout_retry_started: { tone: 'payout', label: 'Relance du reversement', path: 'reversements' },
  message_received: { tone: 'message', label: 'Messagerie', path: 'messages/boite-reception' },
};

/** Texte de secours pour les anciennes notifications sans champ `message`. */
function fallbackText(notif: Notification): string {
  switch (notif.type) {
    case 'reservation':
      return `Demande de réservation pour ${notif.roomTitle ?? ''}`;
    case 'reservation_cancelled':
      return `Réservation annulée pour ${notif.roomTitle ?? ''}`;
    case 'verification_approved':
      return 'Votre vérification a été approuvée';
    case 'verification_rejected':
      return 'Votre vérification a été rejetée';
    case 'verification_submitted':
      return 'Votre demande de vérification a été soumise';
    case 'message_received':
      return 'Nouveau message reçu';
    case 'payout_retry_started':
      return 'Votre reversement a été remis en file d’attente';
    case 'payout_paid':
      return 'Reversement envoyé';
    case 'payout_failed':
      return 'Votre reversement a échoué';
    case 'payout_scheduled':
      return 'Un reversement est programmé';
    case 'payout_details_required':
      return 'Vos coordonnées de reversement doivent être vérifiées';
    case 'payout_details_verified':
      return 'Vos coordonnées de reversement ont été vérifiées';
    default:
      return 'Notification';
  }
}

function notificationText(notif: Notification): string {
  return notif.message?.trim() || fallbackText(notif);
}

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

function NotifIcon({ tone }: { tone: NotifTone }) {
  if (tone === 'verification') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (tone === 'payout') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M12 12h.01M6 12h.01M18 12h.01" />
      </svg>
    );
  }
  if (tone === 'message') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    );
  }
  if (tone === 'cancel') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
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
 * Cloche de notifications du gérant : pastille des non-lues, panneau déroulant,
 * actions contextuelles, toast d'arrivée et vérification d'une demande.
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
  const [toast, setToast] = useState<Notification | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const market = pathname.split('/')[1] || 'ci';

  const showToast = useCallback((notif: Notification) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(notif);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const loadNotifs = useCallback(async () => {
    try {
      const notifs = await getNotifications();
      if (seenIdsRef.current) {
        const fresh = notifs.find((notif) => !seenIdsRef.current?.has(notif.id));
        if (fresh) showToast(fresh);
      }
      seenIdsRef.current = new Set(notifs.map((notif) => notif.id));
      setNotifications(notifs);
      setUnread(notifs.filter((notif) => !notif.read).length);
    } catch {
      // silencieux : le polling réessaiera
    }
  }, [showToast]);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => {
      clearInterval(interval);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
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

  const openNotification = (notif: Notification) => {
    handleNotifClick(notif);
    const path = NOTIF_META[notif.type]?.path;
    if (path) navigate(`/${market}/gerant/${path}`);
    setToast(null);
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
          className={isDashboard ? 'relative p-2 text-dash-navy' : 'topbar__icon-btn'}
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
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
                  const meta = NOTIF_META[notif.type];
                  const canVerify =
                    isQualified && notif.type === 'reservation' && Boolean(notif.reservationId) && !notif.read;
                  return (
                    <div
                      key={notif.id}
                      className={`notif-item ${!notif.read ? 'notif-item--unread' : ''}`}
                    >
                      <button className="notif-item__main" onClick={() => handleNotifClick(notif)}>
                        <div className={`notif-item__icon notif-item__icon--${meta.tone}`}>
                          <NotifIcon tone={meta.tone} />
                        </div>
                        <div className="notif-item__body">
                          <p className="notif-item__text">{notificationText(notif)}</p>
                          <span className="notif-item__dates">{meta.label}</span>
                          <span className="notif-item__time">{timeAgo(notif.date)}</span>
                        </div>
                        {!notif.read && <span className="notif-item__dot" />}
                      </button>
                      <div className="notif-item__actions">
                        {canVerify && (
                          <button
                            className="notif-action notif-action--verify"
                            onClick={() => handleVerify(notif)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="11" cy="11" r="7" />
                              <path d="M21 21l-4.3-4.3" />
                            </svg>
                            Vérifier
                          </button>
                        )}
                        {!canVerify && meta.path && (
                          <button className="notif-action notif-action--open" onClick={() => openNotification(notif)}>
                            Voir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="gerant-notif-toast" role="status" aria-live="polite">
          <span className={`gerant-notif-toast__icon gerant-notif-toast__icon--${NOTIF_META[toast.type].tone}`}>
            <NotifIcon tone={NOTIF_META[toast.type].tone} />
          </span>
          <div className="gerant-notif-toast__body">
            <strong>{NOTIF_META[toast.type].label}</strong>
            <p>{notificationText(toast)}</p>
          </div>
          <button
            type="button"
            className="gerant-notif-toast__open"
            onClick={() => openNotification(toast)}
          >
            Voir
          </button>
          <button
            type="button"
            className="gerant-notif-toast__close"
            aria-label="Fermer la notification"
            onClick={() => setToast(null)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
                  </svg>
                </div>
                <h3>Disponible</h3>
                <p>
                  La chambre <strong>{verify.notif.roomTitle}</strong> est disponible pour les dates demandées.
                </p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--confirm" onClick={handleConfirmFromPopup}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                </div>
                <h3>Non disponible</h3>
                <p>
                  La chambre <strong>{verify.notif.roomTitle}</strong> n&apos;est pas disponible pour les dates demandées.
                </p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--reject" onClick={handleRejectFromPopup}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
