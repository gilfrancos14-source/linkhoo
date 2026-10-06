import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiAdmin, setAdminToken, type AdminData, type AdminNotification } from '../../lib/adminApi';
import { marketSlugFromPath } from '../../contexts/MarketContext';

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
  notif: AdminNotification;
  loading: boolean;
  result: { statut: string; reason: string | null } | null;
}

export default function SuperAdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin-sidebar') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const marketSlug = marketSlugFromPath(pathname);
  const adminPath = marketSlug ? `/${marketSlug}/admin` : '/admin';

  useEffect(() => {
    apiAdmin.getMe().then(setAdmin).catch(() => {});
  }, []);

  const loadNotifs = useCallback(async () => {
    try {
      const data = await apiAdmin.getNotifications();
      setNotifications(data.notifications);
      setUnread(data.unread_count);
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
    localStorage.setItem('admin-sidebar', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
  }, [marketSlug]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setAdminToken(null);
    navigate(marketSlug ? `/${marketSlug}/admin/login` : '/admin/login');
  };

  const handleNotifClick = (n: AdminNotification) => {
    if (!n.read) {
      apiAdmin.markNotificationRead(n.id).then(() => loadNotifs()).catch(() => {});
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await Promise.all(
        notifications.filter((n) => !n.read).map((n) => apiAdmin.markNotificationRead(n.id))
      );
      await loadNotifs();
    } catch {
      // silencieux
    }
  };

  const handleTreat = async (n: AdminNotification) => {
    if (!n.reservation_id) return;
    setVerify({ notif: n, loading: true, result: null });
    try {
      const result = await apiAdmin.checkAvailability(n.reservation_id);
      setVerify({ notif: n, loading: false, result });
      if (!n.read) {
        await apiAdmin.markNotificationRead(n.id);
      }
      await loadNotifs();
    } catch (err) {
      console.error('[Admin] Erreur traitement:', err);
      setVerify({
        notif: n,
        loading: false,
        result: { statut: 'error', reason: err instanceof Error ? err.message : 'Erreur' },
      });
    }
  };

  const navItems = [
    { to: adminPath, label: 'Tableau de bord', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
    { to: `${adminPath}/reservations`, label: 'Réservations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>, pill: unread > 0 ? String(unread) : undefined },
    { to: `${adminPath}/gerants`, label: 'Gérants', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 011.92 2.76"/></svg> },
    { to: `${adminPath}/banners`, label: 'Bannières', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> },
    { to: `${adminPath}/evenements`, label: 'Événements', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="2"/></svg> },
    { to: `${adminPath}/destinations`, label: 'Destinations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> },
    { to: `${adminPath}/promotions`, label: 'Promotions', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
    { to: `${adminPath}/boosts`, label: 'Booster', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> },
    { to: `${adminPath}/mot-de-passe`, label: 'Mot de passe', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
  ];

  return (
    <div className={`admin ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <img src="/logo.jpg" alt="Logo Linkhoo" width="100" />
          </div>
          <button className="sidebar__close-mobile" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <button className="sidebar__toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Déplier' : 'Replier'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
          </button>
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__group">
            <span className="sidebar__label">Administration</span>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === adminPath}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
                {item.pill && <span className="sidebar__pill" style={{ background: '#F59E0B', color: '#fff', fontSize: '10px' }}>{item.pill}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">
                {admin?.prenom || admin?.email || 'Admin'}
              </span>
              <span className="sidebar__user-role">Administrateur</span>
            </div>
          </div>
          <button
            className="sidebar__link"
            onClick={handleLogout}
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8"/></svg>
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
                      notifications.map((n) => (
                        <div key={n.id} className={`notif-item ${!n.read ? 'notif-item--unread' : ''}`}>
                          <button className="notif-item__main" onClick={() => handleNotifClick(n)}>
                            <div className="notif-item__icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                            </div>
                            <div className="notif-item__body">
                              <p className="notif-item__text">
                                {n.type === 'reservation_cancelled' ? (
                                  <>Réservation <strong>annulée</strong> pour <strong>{n.room_title}</strong></>
                                ) : (
                                  <>Demande de réservation pour <strong>{n.room_title}</strong></>
                                )}
                              </p>
                              {n.client_name && (
                                <span className="notif-item__dates">
                                  {n.client_name}{n.client_email ? ` · ${n.client_email}` : ''}
                                </span>
                              )}
                              <span className="notif-item__time">{timeAgo(n.date)}</span>
                            </div>
                            {!n.read && <span className="notif-item__dot" />}
                          </button>
                          {n.reservation_id && n.type !== 'reservation_cancelled' && !n.read && (
                            <div className="notif-item__actions">
                              <button className="notif-action notif-action--verify" onClick={() => handleTreat(n)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                                Traiter
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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
                <span className="verify-modal__room">{verify.notif.room_title}</span>
              </div>
            ) : verify.result?.statut === 'confirmee' ? (
              <div className="verify-modal__result verify-modal__result--available">
                <div className="verify-modal__icon verify-modal__icon--available">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
                  </svg>
                </div>
                <h3>Réservation confirmée</h3>
                <p>La chambre <strong>{verify.notif.room_title}</strong> est disponible. Le client a été notifié.</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Fermer
                  </button>
                </div>
              </div>
            ) : verify.result?.statut === 'annulee' ? (
              <div className="verify-modal__result verify-modal__result--unavailable">
                <div className="verify-modal__icon verify-modal__icon--unavailable">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                </div>
                <h3>Réservation annulée</h3>
                <p>
                  {verify.result.reason === 'chambre_non_disponible'
                    ? <>La chambre <strong>{verify.notif.room_title}</strong> n'est plus disponible.</>
                    : verify.result.reason === 'conflit_dates'
                      ? <>Conflit de dates pour <strong>{verify.notif.room_title}</strong>.</>
                      : <>La réservation pour <strong>{verify.notif.room_title}</strong> a été annulée.</>}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>Le client a été notifié.</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Fermer
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
                <h3>Erreur</h3>
                <p>{verify.result?.reason || 'Une erreur est survenue lors du traitement.'}</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Fermer
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
