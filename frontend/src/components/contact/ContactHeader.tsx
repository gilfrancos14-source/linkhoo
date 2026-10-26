import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../landing/icons';
import { CONTACT_COUNTRIES, type ContactCountry } from './data';

export default function ContactHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [country, setCountry] = useState<ContactCountry>(CONTACT_COUNTRIES[1]);
  const countryRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!countryOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!countryRef.current?.contains(event.target as Node)) {
        setCountryOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [countryOpen]);

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
          <div className="ct-country" ref={countryRef}>
            <button
              type="button"
              className="ct-country__btn"
              aria-label={`Pays : ${country.label}`}
              aria-expanded={countryOpen}
              aria-controls="ct-country-menu"
              onClick={() => setCountryOpen((open) => !open)}
            >
              <span className="ct-country__flag" aria-hidden="true">
                {country.colors.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="ct-country__label">{country.label}</span>
              <Icon name="chevronDown" size={12} />
            </button>

            {countryOpen && (
              <ul id="ct-country-menu" className="ct-country__menu" role="listbox" aria-label="Choisir le pays">
                {CONTACT_COUNTRIES.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.label === country.label}
                      onClick={() => {
                        setCountry(item);
                        setCountryOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
