import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../landing/icons';
import LanguageSwitcher from '../LanguageSwitcher';

export default function AboutHeader() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const goToLanding = () => navigate('/');

  return (
    <header className="ab-header">
      <div className="ab-header__inner">
        <Link to="/" className="ab-brand" aria-label={t('about.nav.brandAria')}>
          <img
            className="ab-brand__logo"
            src="/logo.jpg"
            alt=""
            width={759}
            height={373}
            fetchPriority="high"
          />
        </Link>

        <nav className="ab-nav" aria-label={t('about.nav.mainNav')}>
          <Link to="/" className="ab-nav__link">
            {t('navigation.home')}
          </Link>
          <Link to="/a-propos" className="ab-nav__link ab-nav__link--active" aria-current="page">
            {t('navigation.about')}
          </Link>
          <Link to="/contact" className="ab-nav__link">
            {t('navigation.contact')}
          </Link>
        </nav>

        <div className="ab-header__actions">
          <button
            type="button"
            className="ab-icon-btn"
            aria-label={t('about.nav.search')}
            onClick={goToLanding}
          >
            <Icon name="search" size={20} />
          </button>
          <LanguageSwitcher compact />
          <button
            type="button"
            className="ab-icon-btn"
            aria-label={t('about.nav.menu')}
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
          {t('navigation.home')}
        </Link>
        <Link to="/a-propos" className="ab-mobile-menu__active" onClick={() => setMenuOpen(false)}>
          {t('navigation.about')}
        </Link>
        <Link to="/contact" onClick={() => setMenuOpen(false)}>
          {t('navigation.contact')}
        </Link>
      </div>
    </header>
  );
}
