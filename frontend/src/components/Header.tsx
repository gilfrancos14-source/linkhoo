import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { isRootPath, useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { useEspace } from '../hooks/useEspace';
import MarketSelector from './MarketSelector';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Navigation principale : mêmes cibles que le menu mobile.
// Pages racine (accueil, /a-propos, /contact) : même barre que l'accueil —
// liste réduite « Accueil » + liens de pages (« À propos », « Contact »).
// Pages de marché (/ci, /bj, …) : sections seules, sans ces liens.
// Une entrée porteuse de `route` ouvre une page servie à la racine
// (/a-propos, /contact) au lieu de défiler vers une section.
interface NavItem {
  id: string;
  label: string;
  route?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'categories', label: 'Appartements' },
  { id: 'evenements', label: 'Événements' },
  { id: 'tourisme', label: 'Tourisme' },
  { id: 'avis', label: 'Avis' },
];

const LANDING_NAV_ITEMS: readonly NavItem[] = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'a-propos', label: 'À propos', route: '/a-propos' },
  { id: 'contact', label: 'Contact', route: '/contact' },
];

function LoginButton({ market }: { market: string }) {
  return (
    <Link
      to={`/${market.toLowerCase()}/login`}
      className="header-btn header-btn--login"
      aria-label="Se connecter"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span className="header-btn__label">Se connecter</span>
    </Link>
  );
}

function HeaderAuthActions({ market }: { market: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { resolve, loading } = useEspace();

  if (!isLoaded) return null;
  if (!isSignedIn) return <LoginButton market={market} />;

  return (
    <button
      type="button"
      className="header-btn header-btn--espace"
      aria-label="Mon espace"
      disabled={loading}
      onClick={() => void resolve()}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span className="header-btn__label">Mon espace</span>
    </button>
  );
}

export default function Header() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Pages racine : navigation réduite, pas de bouton de connexion.
  // Pages de marché : navigation complète + « Se connecter » dans la barre.
  const isLanding = isRootPath(location.pathname);
  const navItems = isLanding ? LANDING_NAV_ITEMS : NAV_ITEMS;

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => {
      document.body.classList.remove('nav-open');
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusables = menu.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && menuRef.current) {
      const first = menuRef.current.querySelector<HTMLElement>('button:not([disabled])');
      first?.focus();
    }
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleNav = useCallback((sectionId: string) => {
    closeMenu();
    // /a-propos et /contact partagent la barre de l'accueil mais n'ont pas ses
    // sections : « Accueil » y ramène d'abord.
    if (location.pathname !== '/' && isRootPath(location.pathname)) {
      void navigate('/');
      return;
    }
    // Page d'accueil racine (structure CoinAfrique) : les sections
    // présentes (hero, avis) défilent sur place, les autres ouvrent le
    // marché.
    if (location.pathname === '/') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    if (location.pathname === `/${market.toLowerCase()}`) {
      scrollToSection(sectionId);
    } else {
      void navigate(homePath);
      requestAnimationFrame(() => scrollToSection(sectionId));
    }
  }, [closeMenu, location.pathname, navigate, homePath, market]);

  // Une entrée « route » devient un lien vers une page racine (/a-propos,
  // /contact), les autres restent des boutons qui défilent vers une section de
  // l'accueil.
  const renderNavItem = (item: NavItem, className: string) =>
    item.route ? (
      <Link
        to={item.route}
        className={className}
        onClick={closeMenu}
        aria-current={
          location.pathname === item.route ? 'page' : undefined
        }
      >
        {item.label}
      </Link>
    ) : (
      <button
        type="button"
        className={className}
        onClick={() => handleNav(item.id)}
      >
        {item.label}
      </button>
    );

  return (
    <header className="site-header" id="site-header">
      <div className="container header-inner">
        <Link
          to={isLanding ? '/' : homePath}
          className="logo"
          aria-label="Linkhoo — retour à l'accueil"
        >
          <img className="logo__mark logo__img" src="/logo.jpg" alt="Logo Linkhoo" width="64" height="64" loading="eager" fetchPriority="high" />
        </Link>

        <nav className="header-nav" aria-label="Navigation principale">
          <ul className="header-nav__list">
            {navItems.map((item) => (
              <li key={item.id}>{renderNavItem(item, 'header-nav__link')}</li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <MarketSelector />
          {!isLanding &&
            (clerkConfigured ? (
              <HeaderAuthActions market={market} />
            ) : (
              <LoginButton market={market} />
            ))}
          <button
            type="button"
            className="header-btn header-btn--burger"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="header-btn__bars">
              <span></span><span></span><span></span>
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu__backdrop" onClick={closeMenu} aria-hidden="true" />
      )}

      <div
        ref={menuRef}
        className={`mobile-menu${menuOpen ? ' is-open' : ''}`}
        id="mobile-menu"
        aria-hidden={!menuOpen}
        role="dialog"
        aria-label="Menu de navigation"
      >
        <nav className="mobile-menu__nav" aria-label="Menu mobile">
          <ul className="mobile-menu__list">
            {navItems.map((item) => (
              <li key={item.id}>{renderNavItem(item, 'mobile-menu__link')}</li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
