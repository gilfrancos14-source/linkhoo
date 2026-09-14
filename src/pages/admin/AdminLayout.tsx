import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, addTestNotification, type Notification } from '../../lib/notifications';
import { getRoomsByMarket, getLocalRooms } from '../../data/rooms';
import { updateReservationStatut, getReservationById, checkDateConflict } from '../../lib/reservations';
import { addClientNotification } from '../../lib/notifications';
import { sendWhatsAppClientResponse } from '../../lib/whatsapp';

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
  reservation?: { dateDebut: string; dateFin: string } | null;
}

export default function AdminLayout() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const adminPath = `${homePath}/admin`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin-sidebar') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const roomCount = getRoomsByMarket(market).length + getLocalRooms().filter((r) => r.market === market).length;

  const navGeneral = [
    { to: adminPath, label: 'Aperçu', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
    { to: `${adminPath}/chambres`, label: 'Chambres', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 21V7a2 2 0 012-2h6a2 2 0 012 2v14"/><path d="M13 21V11a2 2 0 012-2h4a2 2 0 012 2v10"/><path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, pill: String(roomCount) },
  ];

  const navGestion = [
    { to: `${adminPath}/categories`, label: 'Catégories', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { to: `${adminPath}/bannieres`, label: 'Bannières', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { to: `${adminPath}/reservations`, label: 'Réservations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  ];

  const loadNotifs = () => {
    setNotifications(getNotifications());
    setUnread(getUnreadCount());
  };

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('admin-sidebar', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotifClick = (n: Notification) => {
    markAsRead(n.id);
    loadNotifs();
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    loadNotifs();
  };

  const handleVerify = (n: Notification) => {
    const reservation = n.reservationId ? getReservationById(n.reservationId) : null;
    setVerify({ notif: n, loading: true, available: null, reservation });

    setTimeout(() => {
      if (!reservation || !reservation.dateDebut || !reservation.dateFin) {
        setVerify((prev) => prev ? { ...prev, loading: false, available: false } : null);
        return;
      }
      const conflict = checkDateConflict(reservation.roomId, reservation.dateDebut, reservation.dateFin, reservation.id);
      setVerify((prev) => prev ? { ...prev, loading: false, available: !conflict.hasConflict } : null);
    }, 1500);
  };

  const handleConfirmFromPopup = () => {
    if (!verify) return;
    const n = verify.notif;
    if (!n.reservationId) return;
    updateReservationStatut(n.reservationId, 'confirmee');
    addClientNotification({
      type: 'reservation_confirmed',
      roomTitle: n.roomTitle,
      roomId: n.roomId,
      clientEmail: n.clientEmail,
      message: `Votre réservation pour "${n.roomTitle}" a été confirmée par l'administrateur.`,
    });
    sendWhatsAppClientResponse({
      clientPhone: n.clientPhone,
      clientName: n.clientName,
      roomTitle: n.roomTitle,
      dateDebut: verify.reservation?.dateDebut || '',
      dateFin: verify.reservation?.dateFin || '',
      confirmed: true,
    });
    markAsRead(n.id);
    setVerify(null);
    loadNotifs();
  };

  const handleRejectFromPopup = () => {
    if (!verify) return;
    const n = verify.notif;
    if (!n.reservationId) return;
    updateReservationStatut(n.reservationId, 'annulee');
    addClientNotification({
      type: 'reservation_rejected',
      roomTitle: n.roomTitle,
      roomId: n.roomId,
      clientEmail: n.clientEmail,
      message: `Désolé, "${n.roomTitle}" n'est pas disponible pour les dates souhaitées.`,
    });
    sendWhatsAppClientResponse({
      clientPhone: n.clientPhone,
      clientName: n.clientName,
      roomTitle: n.roomTitle,
      dateDebut: verify.reservation?.dateDebut || '',
      dateFin: verify.reservation?.dateFin || '',
      confirmed: false,
    });
    markAsRead(n.id);
    setVerify(null);
    loadNotifs();
  };

  return (
    <div className={`admin ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <img className="sidebar__logo-img" src="/logo.jpg" alt="Logo Ilehya" width="100" />
          </div>
          <button className="sidebar__close-mobile" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <button className="sidebar__toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Réduire le menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__group">
            <span className="sidebar__label">Général</span>
            {navGeneral.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/admin'}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
                {item.pill && <span className="sidebar__pill">{item.pill}</span>}
              </NavLink>
            ))}
          </div>
          <div className="sidebar__group">
            <span className="sidebar__label">Gestion</span>
            {navGestion.map((item) => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">AD</div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">Admin</span>
              <span className="sidebar__user-role">Administrateur</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <button className="topbar__menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Ouvrir le menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>

          <div className="topbar__search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <input type="text" placeholder="Rechercher..." aria-label="Rechercher" />
          </div>

          <div className="topbar__right">
            <button className="topbar__icon-btn" aria-label="Notification test" title="Générer une notification test" onClick={() => { addTestNotification(); loadNotifs(); }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </button>
            <div className="notif-wrapper" ref={notifRef}>
              <button className="topbar__icon-btn" aria-label="Notifications" onClick={() => setNotifOpen(!notifOpen)}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                {unread > 0 && <span className="topbar__badge">{unread}</span>}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown__head">
                    <span>Notifications</span>
                    {unread > 0 && (
                      <button className="notif-dropdown__mark" onClick={handleMarkAllRead}>Tout marquer lu</button>
                    )}
                  </div>
                  <div className="notif-dropdown__list">
                    {notifications.length === 0 ? (
                      <p className="notif-dropdown__empty">Aucune notification</p>
                    ) : (
                      notifications.map((n) => {
                        const reservation = n.reservationId ? getReservationById(n.reservationId) : null;
                        return (
                          <div key={n.id} className={`notif-item ${!n.read ? 'notif-item--unread' : ''}`}>
                            <button className="notif-item__main" onClick={() => handleNotifClick(n)}>
                              <div className="notif-item__icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                              </div>
                              <div className="notif-item__body">
                                <p className="notif-item__text">
                                  Demande de réservation pour <strong>{n.roomTitle}</strong>
                                </p>
                                {reservation && reservation.dateDebut && (
                                  <span className="notif-item__dates">
                                    Du {new Date(reservation.dateDebut).toLocaleDateString('fr-FR')} au {new Date(reservation.dateFin).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                                <span className="notif-item__time">{timeAgo(n.date)}</span>
                              </div>
                              {!n.read && <span className="notif-item__dot" />}
                            </button>
                            {n.type === 'reservation' && n.reservationId && !n.read && (
                              <div className="notif-item__actions">
                                <button className="notif-action notif-action--verify" onClick={() => handleVerify(n)}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
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

            <NavLink to={homePath} className="topbar__cta">Retour au site</NavLink>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>

      {verify && (
        <div className="verify-overlay" onClick={() => !verify.loading && setVerify(null)}>
          <div className="verify-modal" onClick={(e) => e.stopPropagation()}>
            {verify.loading ? (
              <div className="verify-modal__loading">
                <div className="verify-spinner" />
                <p>Vérification de la disponibilité...</p>
                <span className="verify-modal__room">{verify.notif.roomTitle}</span>
              </div>
            ) : verify.available ? (
              <div className="verify-modal__result verify-modal__result--available">
                <div className="verify-modal__icon verify-modal__icon--available">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
                  </svg>
                </div>
                <h3>Disponible</h3>
                <p>La chambre <strong>{verify.notif.roomTitle}</strong> est disponible pour les dates demandées.</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--confirm" onClick={handleConfirmFromPopup}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                </div>
                <h3>Non disponible</h3>
                <p>La chambre <strong>{verify.notif.roomTitle}</strong> n'est pas disponible pour les dates demandées.</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--reject" onClick={handleRejectFromPopup}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
    </div>
  );
}
