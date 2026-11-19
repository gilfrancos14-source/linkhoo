import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantTheme, GerantThemeProvider } from '../../hooks/useGerantTheme';
import { fetchMyRooms } from '../../data/rooms';
import GerantNotifications from '../../components/gerant/GerantNotifications';
import { apiGerants, apiMessages, type GerantData } from '../../lib/api';
import { GerantSessionProvider } from '../../contexts/GerantSessionContext';
import { isPremiumActive } from '../../lib/premium';
import { clearSessionCaches } from '../../lib/pwaCleanup';
import '../../styles/18-admin.css';
import '../../styles/33-gerant-blank.css';
import '../../styles/gerant-dark.css';
import GerantThemeToggle from '../../components/gerant/GerantThemeToggle';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = clerkKey && clerkKey.startsWith('pk_');

export default function AdminLayout() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isDark } = useGerantTheme();
  const gerantPath = `${homePath}/gerant`;
  const themeClass = isDark ? 'gerant-dark' : '';
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('gerant-sidebar') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [roomCount, setRoomCount] = useState(0);
  const [gerant, setGerant] = useState<GerantData | null>(null);
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

  const isQualified = !!gerant?.is_verified;

  const navGestion = [
    ...(isQualified ? [{ to: `${gerantPath}/reservations`, label: 'Réservations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> }] : []),
    ...(isQualified ? [{ to: `${gerantPath}/reservations/demandes`, label: 'Demandes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }] : []),
    ...(isQualified ? [{ to: `${gerantPath}/reservations/calendrier`, label: 'Calendrier', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg> }] : []),
    { to: `${gerantPath}/reversements`, label: 'Reversements', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg> },
    { to: `${gerantPath}/messages/boite-reception`, label: 'Messages', pill: messagesUnread > 0 ? String(messagesUnread) : undefined, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
    { to: `${gerantPath}/messages/boite-reception`, label: 'Boîte de réception', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.4 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.4-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.8 1.1z"/></svg> },
    { to: `${gerantPath}/verification`, label: 'Vérification', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
    { to: `${gerantPath}/profil`, label: 'Profil', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  const navAbonnement = [
    { to: `${gerantPath}/premium`, label: 'Premium', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ];

  // Badge « Messages » : compteur de non-lus reçus, rafraîchi comme les
  // notifications (30 s). Silencieux en cas d'échec — le polling réessaiera.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiMessages
        .gerantUnread()
        .then(({ count }) => {
          if (!cancelled) setMessagesUnread(count);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('gerant-sidebar', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = useCallback(() => {
    void clearSessionCaches();
    if (clerkConfigured) {
      void signOut({ redirectUrl: `/${market.toLowerCase()}/login` });
    } else {
      navigate(`/${market.toLowerCase()}`);
    }
  }, [market, navigate, signOut]);

  // Les pages qui reproduisent une maquette complète (maq1, maq2) embarquent
  // leur propre sidebar et leur propre topbar : on masque le chrome admin.
  const isBlankPage =
    pathname === gerantPath ||
    pathname === `${gerantPath}/` ||
    pathname === `${gerantPath}/chambres` ||
    pathname === `${gerantPath}/chambres/` ||
    pathname === `${gerantPath}/chambres/ajouter` ||
    pathname === `${gerantPath}/chambres/ajouter/` ||
    pathname === `${gerantPath}/reservations/demandes` ||
    pathname === `${gerantPath}/reservations/demandes/` ||
    pathname === `${gerantPath}/reservations/calendrier` ||
    pathname === `${gerantPath}/reservations/calendrier/` ||
    pathname === `${gerantPath}/messages/boite-reception` ||
    pathname === `${gerantPath}/messages/boite-reception/` ||
    pathname === `${gerantPath}/verification` ||
    pathname === `${gerantPath}/verification/` ||
    pathname === `${gerantPath}/verification/suivi` ||
    pathname === `${gerantPath}/verification/suivi/` ||
    pathname === `${gerantPath}/profil` ||
    pathname === `${gerantPath}/profil/` ||
    pathname === `${gerantPath}/premium` ||
    pathname === `${gerantPath}/premium/`;

  // Pages au style « admin-page » : la sidebar admin est remplacée par la
  // sidebar gérant partagée, la topbar est conservée.
  const isMaqSidebarPage =
    pathname === `${gerantPath}/reservations` ||
    pathname === `${gerantPath}/reservations/` ||
    pathname === `${gerantPath}/reversements` ||
    pathname === `${gerantPath}/reversements/` ||
    pathname === `${gerantPath}/premium/success` ||
    pathname === `${gerantPath}/premium/success/`;

  return (
    <GerantThemeProvider>
      <GerantSessionProvider value={handleSignOut}>
        <div className={`admin ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''} ${isBlankPage ? 'admin--blank' : ''} ${isMaqSidebarPage ? 'admin--maq-sidebar' : ''} ${themeClass}`}>
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
              <NavLink key={`${item.to}::${item.label}`} to={item.to} end={item.to === `${gerantPath}/messages`}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
                {item.pill && <span className="sidebar__pill">{item.pill}</span>}
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
                {isPremiumActive(gerant) && (
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
            <div className="sidebar__avatar" aria-hidden="true">
              {(gerant?.prenom || user?.firstName || 'G').trim().charAt(0).toUpperCase()}
            </div>
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
                {isPremiumActive(gerant) && (
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
            onClick={handleSignOut}
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
            {!isBlankPage && <GerantNotifications isQualified={isQualified} />}

            <GerantThemeToggle />

            <NavLink to={homePath} className="topbar__cta">Retour au site</NavLink>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
      </div>
    </GerantSessionProvider>
    </GerantThemeProvider>
  );
}
