import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { useEspace } from '../hooks/useEspace';
import MarketSelector from './MarketSelector';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

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

function MobileAuthLinks({
  market,
  onNavigate,
}: {
  market: string;
  onNavigate: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { resolve, loading } = useEspace();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <li>
        <button
          type="button"
          className="mobile-menu__link mobile-menu__link--auth"
          disabled={loading}
          onClick={() => {
            onNavigate();
            void resolve();
          }}
        >
          Mon espace
        </button>
      </li>
    );
  }

  return (
    <>
      <li>
        <Link
          to={`/${market.toLowerCase()}/login`}
          className="mobile-menu__link mobile-menu__link--auth"
          onClick={onNavigate}
        >
          Se connecter
        </Link>
      </li>
      <li>
        <Link
          to={`/${market.toLowerCase()}/inscription`}
          className="mobile-menu__link mobile-menu__link--auth mobile-menu__link--auth-alt"
          onClick={onNavigate}
        >
          S'inscrire
        </Link>
      </li>
    </>
  );
}

function StaticAuthLinks({
  market,
  onNavigate,
}: {
  market: string;
  onNavigate: () => void;
}) {
  return (
    <>
      <li>
        <Link
          to={`/${market.toLowerCase()}/login`}
          className="mobile-menu__link mobile-menu__link--auth"
          onClick={onNavigate}
        >
          Se connecter
        </Link>
      </li>
      <li>
        <Link
          to={`/${market.toLowerCase()}/inscription`}
          className="mobile-menu__link mobile-menu__link--auth mobile-menu__link--auth-alt"
          onClick={onNavigate}
        >
          S'inscrire
        </Link>
      </li>
    </>
  );
}

export default function Header() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (location.pathname === `/${market.toLowerCase()}`) {
      scrollToSection(sectionId);
    } else {
      void navigate(homePath);
      requestAnimationFrame(() => scrollToSection(sectionId));
    }
  }, [closeMenu, location.pathname, navigate, homePath, market]);

  return (
    <header className="site-header" id="site-header">
      <div className="container header-inner">
        <Link to={homePath} className="logo" aria-label="Linkhoo — retour à l'accueil">
          <img className="logo__mark logo__img" src="/logo.jpg" alt="Logo Linkhoo" width="64" height="64" loading="eager" fetchPriority="high" />
        </Link>

        <div className="header-actions">
          <MarketSelector />
          {clerkConfigured ? (
            <HeaderAuthActions market={market} />
          ) : (
            <LoginButton market={market} />
          )}
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
            <li><button className="mobile-menu__link" onClick={() => handleNav('accueil')}>Accueil</button></li>
            <li><button className="mobile-menu__link" onClick={() => handleNav('categories')}>Appartements</button></li>
            <li><button className="mobile-menu__link" onClick={() => handleNav('evenements')}>Événements</button></li>
            <li><button className="mobile-menu__link" onClick={() => handleNav('tourisme')}>Tourisme</button></li>
            <li><button className="mobile-menu__link" onClick={() => handleNav('avis')}>Avis</button></li>
            <li className="mobile-menu__divider" aria-hidden="true"></li>
            {clerkConfigured ? (
              <MobileAuthLinks market={market} onNavigate={closeMenu} />
            ) : (
              <StaticAuthLinks market={market} onNavigate={closeMenu} />
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
