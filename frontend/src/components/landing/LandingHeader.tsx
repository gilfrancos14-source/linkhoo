import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './icons';
import LanguageSwitcher from '../LanguageSwitcher';

export interface HeaderItem {
  readonly label: string;
  /** Clé i18next pour les libellés par défaut (les pages marchés gardent leur label). */
  readonly labelKey?: string;
  readonly href: string;
  readonly active?: boolean;
}

export interface HeaderAccount {
  readonly to: string;
  readonly label: string;
}

interface LandingHeaderProps {
  onSearchClick: () => void;
  items?: readonly HeaderItem[];
  brandTo?: string;
  onItemClick?: (href: string) => void;
  account?: HeaderAccount;
}

const DEFAULT_ITEMS: readonly HeaderItem[] = [
  { label: 'Accueil', labelKey: 'navigation.home', href: '/', active: true },
  { label: 'À propos', labelKey: 'navigation.about', href: '/a-propos' },
  { label: 'Contact', labelKey: 'navigation.contact', href: '/contact' },
];

export default function LandingHeader({
  onSearchClick,
  items = DEFAULT_ITEMS,
  brandTo = '/',
  onItemClick,
  account,
}: LandingHeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Les pages marchés passent leurs propres libellés (déjà dans leur contexte) :
  // seuls les éléments par défaut de la landing sont traduits ici.
  const navItems = items.map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey) : item.label,
  }));

  const navLink = (item: HeaderItem) =>
    `acc-nav__link${item.active ? ' acc-nav__link--active' : ''}`;

  return (
    <header className="acc-header">
      <div className="acc-container acc-header__inner">
        <Link to={brandTo} className="acc-brand" aria-label={t('landing.header.brandAria')}>
          <img
            className="acc-brand__logo"
            src="/logo.jpg"
            alt=""
            width={759}
            height={373}
            fetchPriority="high"
          />
        </Link>

        <nav className="acc-nav" aria-label={t('landing.header.mainNav')}>
          {navItems.map((item) =>
            onItemClick ? (
              <button
                key={item.href}
                type="button"
                className={navLink(item)}
                onClick={() => onItemClick(item.href)}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.href} to={item.href} className={navLink(item)}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="acc-header__actions">
          <button type="button" className="acc-icon-btn" aria-label={t('landing.header.searchAria')} onClick={onSearchClick}>
            <Icon name="search" size={24} />
          </button>
          {account && (
            <Link to={account.to} className="acc-account-btn" aria-label={account.label}>
              <Icon name="userRound" size={20} />
              <span>{account.label}</span>
            </Link>
          )}
          <LanguageSwitcher compact />
          <button
            type="button"
            className="acc-icon-btn"
            aria-label={t('landing.header.menuAria')}
            aria-expanded={menuOpen}
            aria-controls="acc-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name="menu" size={28} />
          </button>
        </div>
      </div>

      <div
        id="acc-mobile-menu"
        className={`acc-mobile-menu${menuOpen ? ' acc-mobile-menu--open' : ''}`}
      >
        {navItems.map((item) =>
          onItemClick ? (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                onItemClick(item.href);
                setMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ) : (
            <Link key={item.href} to={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ),
        )}
      </div>
    </header>
  );
}
