import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../landing/icons';

export default function AboutHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const goToLanding = () => navigate('/');

  return (
    <header className="ab-header">
      <div className="ab-header__inner">
        <Link to="/" className="ab-brand" aria-label="Linkhoo – accueil">
          <img
            className="ab-brand__logo"
            src="/logo.jpg"
            alt=""
            width={759}
            height={373}
            fetchPriority="high"
          />
        </Link>

        <nav className="ab-nav" aria-label="Navigation principale">
          <Link to="/" className="ab-nav__link">
            Accueil
          </Link>
          <Link to="/a-propos" className="ab-nav__link ab-nav__link--active" aria-current="page">
            À propos
          </Link>
          <Link to="/contact" className="ab-nav__link">
            Contact
          </Link>
        </nav>

        <div className="ab-header__actions">
          <button
            type="button"
            className="ab-country"
            aria-label="Choisir le pays"
            onClick={goToLanding}
          >
            <span className="ab-country__flag" aria-hidden="true" />
            <span>Côte d&apos;Ivoire</span>
            <Icon name="chevronDown" size={14} />
          </button>
          <button
            type="button"
            className="ab-icon-btn"
            aria-label="Rechercher"
            onClick={goToLanding}
          >
            <Icon name="search" size={20} />
          </button>
          <button
            type="button"
            className="ab-icon-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="ab-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name="menu" size={24} />
          </button>
        </div>
      </div>

      <div
        id="ab-mobile-menu"
        className={`ab-mobile-menu${menuOpen ? ' ab-mobile-menu--open' : ''}`}
      >
        <Link to="/" onClick={() => setMenuOpen(false)}>
          Accueil
        </Link>
        <Link to="/a-propos" className="ab-mobile-menu__active" onClick={() => setMenuOpen(false)}>
          À propos
        </Link>
        <Link to="/contact" onClick={() => setMenuOpen(false)}>
          Contact
        </Link>
      </div>
    </header>
  );
}
