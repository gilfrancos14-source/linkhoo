import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { useClientUnread } from '../hooks/useClientUnread';
import { getMyReservations } from '../lib/reservations';
import { setAuthTokenGetter } from '../lib/api';
import ClientNotificationBell from './ClientNotificationBell';

export type ClientSection = 'overview' | 'stays' | 'profile' | 'messages';

const iconGrid: ReactNode = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>
);
const iconCalendar: ReactNode = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
);
const iconChat: ReactNode = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
);
const iconUser: ReactNode = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

function todayLabel(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Chrome de l'espace client (mêmes codes que le back-office gérant) : sidebar
 * repliable, groupe « Mon espace », topbar et zone de contenu. Partagé par
 * /compte et /messages pour que les deux pages aient le même design.
 */
export default function ClientAccountLayout({
  active,
  staysCount,
  children,
}: {
  active: ClientSection;
  staysCount?: number;
  children: ReactNode;
}) {
  const homePath = useHomePath();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const unreadMessages = useClientUnread();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('client-sidebar') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fetchedStays, setFetchedStays] = useState(0);

  const email = user?.primaryEmailAddress?.emailAddress
    || user?.emailAddresses?.[0]?.emailAddress
    || '';
  const firstName = user?.firstName || '';
  const displayName = firstName || email || 'Client';

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (staysCount !== undefined || !isLoaded || !isSignedIn) return;
    let cancelled = false;
    getMyReservations()
      .then((res) => { if (!cancelled) setFetchedStays(res.length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, staysCount]);

  useEffect(() => {
    localStorage.setItem('client-sidebar', String(collapsed));
  }, [collapsed]);

  const totalStays = staysCount ?? fetchedStays;

  const handleSignOut = async () => {
    await signOut();
    navigate(homePath);
  };

  return (
    <div className={`admin ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
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
            <span className="sidebar__label">Mon espace</span>
            <Link
              to={`${homePath}/compte`}
              className={`sidebar__link ${active === 'overview' ? 'sidebar__link--active' : ''}`}
            >
              {iconGrid}
              <span>Vue d'ensemble</span>
            </Link>
            <Link
              to={`${homePath}/compte?view=stays`}
              className={`sidebar__link ${active === 'stays' ? 'sidebar__link--active' : ''}`}
            >
              {iconCalendar}
              <span>Mes séjours</span>
              {totalStays > 0 && <span className="sidebar__pill">{totalStays}</span>}
            </Link>
          </div>
          <div className="sidebar__group">
            <span className="sidebar__label">Compte</span>
            <Link
              to={`${homePath}/messages`}
              className={`sidebar__link ${active === 'messages' ? 'sidebar__link--active' : ''}`}
            >
              {iconChat}
              <span>Messages</span>
              {unreadMessages > 0 && (
                <span className="sidebar__pill">{unreadMessages > 99 ? '99+' : unreadMessages}</span>
              )}
            </Link>
            <Link
              to={`${homePath}/compte?view=profile`}
              className={`sidebar__link ${active === 'profile' ? 'sidebar__link--active' : ''}`}
            >
              {iconUser}
              <span>Mon profil</span>
            </Link>
          </div>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar" aria-hidden="true">
              {displayName.charAt(0).toUpperCase() || 'C'}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{displayName}</span>
              <span className="sidebar__user-role">Espace client</span>
            </div>
          </div>
          <button
            className="sidebar__link"
            onClick={() => void handleSignOut()}
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
            <ClientNotificationBell />
            <span className="cdash-top__date">{todayLabel()}</span>
            <Link to={homePath} className="topbar__cta">Retour au site</Link>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
