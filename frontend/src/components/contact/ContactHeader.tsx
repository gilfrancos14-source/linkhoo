import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../landing/icons';
import LanguageSwitcher from '../LanguageSwitcher';

export default function ContactHeader() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="ct-header">
      <div className="ct-header__inner">
        <Link to="/" className="ct-brand" aria-label={t('contact.header.brandAria')}>
          <img
            className="ct-brand__logo"
            src="/logo.jpg"
            alt=""
            width={759}
            height={373}
            fetchPriority="high"
          />
        </Link>

        <nav className="ct-nav" aria-label={t('contact.header.mainNav')}>
          <Link to="/" className="ct-nav__link">
            {t('navigation.home')}
          </Link>
          <Link to="/a-propos" className="ct-nav__link">
            {t('navigation.about')}
          </Link>
          <Link to="/contact" className="ct-nav__link ct-nav__link--active" aria-current="page">
            {t('navigation.contact')}
          </Link>
        </nav>

        <div className="ct-header__actions">
          <button
            type="button"
            className="ct-icon-btn"
            aria-label={t('contact.header.search')}
            onClick={() => navigate('/')}
          >
            <Icon name="search" size={18} />
          </button>
          <LanguageSwitcher compact />
          <button
            type="button"
            className="ct-icon-btn"
            aria-label={t('contact.header.menu')}
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
          {t('navigation.home')}
        </Link>
        <Link to="/a-propos" onClick={() => setMenuOpen(false)}>
          {t('navigation.about')}
        </Link>
        <Link to="/contact" className="ct-mobile-menu__active" onClick={() => setMenuOpen(false)}>
          {t('navigation.contact')}
        </Link>
      </div>
    </header>
  );
}
