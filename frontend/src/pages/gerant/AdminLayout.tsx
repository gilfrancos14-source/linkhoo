import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { getNotifications, markAsRead, markAllAsRead, type Notification } from '../../lib/notifications';
import { fetchMyRooms } from '../../data/rooms';
import { updateReservationStatut, getReservations, checkDateConflict } from '../../lib/reservations';
import { addClientNotification } from '../../lib/notifications';
import { apiGerants, type GerantData } from '../../lib/api';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = clerkKey && clerkKey.startsWith('pk_');

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
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const gerantPath = `${homePath}/gerant`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('gerant-sidebar') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const [roomCount, setRoomCount] = useState(0);
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    fetchMyRooms().then((rooms) => setRoomCount(rooms.length));
  }, [market]);

  useEffect(() => {
    apiGerants.getMe().then(setGerant).catch(() => {});
  }, [userId]);

  const navGeneral = [
    { to: gerantPath, label: 'Aperçu', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
    { to: `${gerantPath}/chambres`, label: 'Chambres', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 21V7a2 2 0 012-2h6a2 2 0 012 2v14"/><path d="M13 21V11a2 2 0 012-2h4a2 2 0 012 2v10"/><path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, pill: String(roomCount) },
  ];

  const isQualified = !!gerant?.is_verified
    && !!gerant?.is_premium
    && (!gerant?.premium_expires_at || new Date(gerant.premium_expires_at) > new Date());

  const navGestion = [
    ...(isQualified ? [{ to: `${gerantPath}/reservations`, label: 'Réservations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> }] : []),
    { to: `${gerantPath}/verification`, label: 'Vérification', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
    { to: `${gerantPath}/profil`, label: 'Profil', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  const navAbonnement = [
    { to: `${gerantPath}/premium`, label: 'Premium', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ];

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

  useEffect(() => {
    localStorage.setItem('gerant-sidebar', String(collapsed));
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

  const handleVerify = async (n: Notification) => {
    setVerify({ notif: n, loading: true, available: null, reservation: null });

    try {
      const allRes = await getReservations();
      const reservation = n.reservationId ? allRes.find((r) => r.id === n.reservationId) ?? null : null;
      setVerify((prev) => prev ? { ...prev, reservation } : null);

      if (!reservation || !reservation.dateDebut || !reservation.dateFin) {
        setVerify((prev) => prev ? { ...prev, loading: false, available: false } : null);
        return;
      }
      const conflict = await checkDateConflict(reservation.roomId, reservation.dateDebut, reservation.dateFin, reservation.id);
      setVerify((prev) => prev ? { ...prev, loading: false, available: !conflict.hasConflict } : null);
    } catch (err) {
      console.error('[AdminLayout] Erreur vérification:', err);
      setVerify((prev) => prev ? { ...prev, loading: false, available: false } : null);
    }
  };

  const handleConfirmFromPopup = async () => {
    if (!verify) return;
    const n = verify.notif;
    if (!n.reservationId) return;
    try {
      await updateReservationStatut(n.reservationId, 'confirmee');

      await addClientNotification({
        type: 'reservation_confirmed',
        roomTitle: n.roomTitle,
        roomId: n.roomId,
        clientEmail: n.clientEmail,
        message: `Votre réservation pour "${n.roomTitle}" a été confirmée par l'administrateur.`,
      });
      await markAsRead(n.id);
    } catch (err) {
      console.error('[AdminLayout] Erreur confirmation:', err);
    }
    setVerify(null);
    loadNotifs();
  };

  const handleRejectFromPopup = async () => {
    if (!verify) return;
    const n = verify.notif;
    if (!n.reservationId) return;
    try {
      await updateReservationStatut(n.reservationId, 'annulee');
      await addClientNotification({
        type: 'reservation_rejected',
        roomTitle: n.roomTitle,
        roomId: n.roomId,
        clientEmail: n.clientEmail,
        message: `Désolé, "${n.roomTitle}" n'est pas disponible pour les dates souhaitées.`,
      });
      await markAsRead(n.id);
    } catch (err) {
      console.error('[AdminLayout] Erreur rejet:', err);
    }
    setVerify(null);
    loadNotifs();
  };

  return (
    <div className={`admin ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <img className="sidebar__logo-img" src="/logo.jpg" alt="Logo Linkhoo" width="100" />
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
              <NavLink key={item.to} to={item.to} end={item.to === gerantPath}
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
          <div className="sidebar__group">
            <span className="sidebar__label">Abonnement</span>
            {navAbonnement.map((item) => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
                {gerant?.is_premium && (
                  <span className="sidebar__pill" style={{ background: '#F59E0B', color: '#fff', fontSize: '10px' }}>
                    PRO
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">
                {gerant?.prenom || user?.firstName || gerant?.email || user?.emailAddresses?.[0]?.emailAddress || 'Gérant'}
                {gerant?.is_verified && (
                  <span className="verified-badge" title="Gérant vérifié">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <path d="M9 12l2 2 4-4"/>
                    </svg>
                  </span>
                )}
                {gerant?.is_premium && (
                  <span className="verified-badge" title="Gérant Premium" style={{ color: '#F59E0B' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </span>
                )}
              </span>
              <span className="sidebar__user-role">Gérant immobilier</span>
            </div>
          </div>
          <button
            className="sidebar__link"
            onClick={() => {
              if (clerkConfigured) {
                void signOut({ redirectUrl: `/${market.toLowerCase()}/login` });
              } else {
                navigate(`/${market.toLowerCase()}`);
              }
            }}
            style={{ width: '100%', justifyContent: 'flex-start', marginTop: '0.5rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <button className="topbar__menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Ouvrir le menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>

          <div className="topbar__right">
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
                        const isVerification = n.type === 'verification_submitted' || n.type === 'verification_approved' || n.type === 'verification_rejected';
                        return (
                          <div key={n.id} className={`notif-item ${!n.read ? 'notif-item--unread' : ''}`}>
                            <button className="notif-item__main" onClick={() => handleNotifClick(n)}>
                              <div className="notif-item__icon">
                                {isVerification ? (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                                )}
                              </div>
                              <div className="notif-item__body">
                                <p className="notif-item__text">
                                  {isVerification ? (
                                    n.type === 'verification_approved' ? (
                                      <>Votre vérification a été <strong>approuvée</strong></>
                                    ) : n.type === 'verification_rejected' ? (
                                      <>Votre vérification a été <strong>rejetée</strong></>
                                    ) : (
                                      <>Votre demande de vérification a été <strong>soumise</strong></>
                                    )
                                  ) : n.type === 'reservation_cancelled' ? (
                                    <>Réservation <strong>annulée</strong> pour <strong>{n.roomTitle}</strong></>
                                  ) : (
                                    <>Demande de réservation pour <strong>{n.roomTitle}</strong></>
                                  )}
                                </p>
                                {n.type === 'reservation' && (
                                  <span className="notif-item__dates">
                                    Réservation en attente
                                  </span>
                                )}
                                {n.type === 'reservation_cancelled' && (
                                  <span className="notif-item__dates">
                                    Annulée par le client
                                  </span>
                                )}
                                <span className="notif-item__time">{timeAgo(n.date)}</span>
                              </div>
                              {!n.read && <span className="notif-item__dot" />}
                            </button>
                            {isQualified && n.type === 'reservation' && n.reservationId && !n.read && (
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
