import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../landing/icons';

export default function ContactHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="ct-header">
      <div className="ct-header__inner">
        <Link to="/" className="ct-brand" aria-label="Linkhoo – accueil">
          <img
            className="ct-brand__logo"
            src="/logo.jpg"
            alt=""
            width={759}
            height={373}
            fetchPriority="high"
          />
        </Link>

        <nav className="ct-nav" aria-label="Navigation principale">
          <Link to="/" className="ct-nav__link">
            Accueil
          </Link>
          <Link to="/a-propos" className="ct-nav__link">
            À propos
          </Link>
          <Link to="/contact" className="ct-nav__link ct-nav__link--active" aria-current="page">
            Contact
          </Link>
        </nav>

        <div className="ct-header__actions">
          <button
            type="button"
            className="ct-icon-btn"
            aria-label="Rechercher"
            onClick={() => navigate('/')}
          >
            <Icon name="search" size={18} />
          </button>
          <button
            type="button"
            className="ct-icon-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="ct-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>

      <div
        id="ct-mobile-menu"
        className={`ct-mobile-menu${menuOpen ? ' ct-mobile-menu--open' : ''}`}
      >
        <Link to="/" onClick={() => setMenuOpen(false)}>
          Accueil
        </Link>
        <Link to="/a-propos" onClick={() => setMenuOpen(false)}>
          À propos
        </Link>
        <Link to="/contact" className="ct-mobile-menu__active" onClick={() => setMenuOpen(false)}>
          Contact
        </Link>
      </div>
    </header>
  );
}
