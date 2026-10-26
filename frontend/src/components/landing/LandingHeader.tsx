import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './icons';
import type { Country } from './data';

export interface HeaderItem {
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
}

export interface HeaderAccount {
  readonly to: string;
  readonly label: string;
}

interface LandingHeaderProps {
  country: Country;
  onCountryClick: () => void;
  onSearchClick: () => void;
  items?: readonly HeaderItem[];
  brandTo?: string;
  onItemClick?: (href: string) => void;
  account?: HeaderAccount;
}

const DEFAULT_ITEMS: readonly HeaderItem[] = [
  { label: 'Accueil', href: '/', active: true },
  { label: 'À propos', href: '/a-propos' },
  { label: 'Contact', href: '/contact' },
];

export default function LandingHeader({
  country,
  onCountryClick,
  onSearchClick,
  items = DEFAULT_ITEMS,
  brandTo = '/',
  onItemClick,
  account,
}: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLink = (item: HeaderItem) =>
    `acc-nav__link${item.active ? ' acc-nav__link--active' : ''}`;

  return (
    <header className="acc-header">
      <div className="acc-container acc-header__inner">
        <Link to={brandTo} className="acc-brand" aria-label="Linkhoo — accueil">
          <img
            className="acc-brand__logo"
            src="/logo.jpg"
            alt=""
            width={759}
            height={373}
            fetchPriority="high"
          />
        </Link>

        <nav className="acc-nav" aria-label="Navigation principale">
          {items.map((item) =>
            onItemClick ? (
              <button
                key={item.label}
                type="button"
                className={navLink(item)}
                onClick={() => onItemClick(item.href)}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.label} to={item.href} className={navLink(item)}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="acc-header__actions">
          <button
            type="button"
            className="acc-country-btn"
            onClick={onCountryClick}
            aria-label={`Pays : ${country.label}`}
          >
            <span className="acc-flag" style={{ background: country.flag }} aria-hidden="true" />
            <span>{country.label}</span>
            <Icon name="chevronDown" size={16} />
          </button>
          <button type="button" className="acc-icon-btn" aria-label="Rechercher" onClick={onSearchClick}>
            <Icon name="search" size={24} />
          </button>
          {account && (
            <Link to={account.to} className="acc-account-btn" aria-label={account.label}>
              <Icon name="userRound" size={20} />
              <span>{account.label}</span>
            </Link>
          )}
          <button
            type="button"
            className="acc-icon-btn"
            aria-label="Menu"
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
        {items.map((item) =>
          onItemClick ? (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                onItemClick(item.href);
                setMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ) : (
            <Link key={item.label} to={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ),
        )}
      </div>
    </header>
  );
}
