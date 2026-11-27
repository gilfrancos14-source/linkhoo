import { useEffect, useRef, useState } from 'react';
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

/** Liens client affichés dans la barre des pages marché. */
export interface HeaderAuth {
  readonly signupTo: string;
  readonly loginTo: string;
}

interface LandingHeaderProps {
  onSearchClick?: () => void;
  items?: readonly HeaderItem[];
  brandTo?: string;
  onItemClick?: (href: string) => void;
  account?: HeaderAccount;
  /** Les pages marché masquent recherche, compte et menu utilisateur. */
  showActions?: boolean;
  /** Bouton de recherche de la landing (désactivé sur la landing racine). */
  showSearch?: boolean;
  /** Bouton hamburger simple (sans avatar) qui ouvre le menu des sections. */
  showMenu?: boolean;
  auth?: HeaderAuth;
  /** Lien « Devenir hôte » de la landing, placé avant le sélecteur de langue. */
  hostLink?: string;
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
  showActions = true,
  showSearch = true,
  showMenu = false,
  auth,
  hostLink,
}: LandingHeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur / Échap, comme un vrai menu déroulant.
  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
          {showActions && showSearch && (
            <button type="button" className="acc-icon-btn" aria-label={t('landing.header.searchAria')} onClick={onSearchClick}>
              <Icon name="search" size={24} />
            </button>
          )}
          {showActions && account && (
            <Link to={account.to} className="acc-account-btn" aria-label={account.label}>
              <Icon name="userRound" size={20} />
              <span>{account.label}</span>
            </Link>
          )}
          {hostLink && (
            <Link to={hostLink} className="acc-become-host">
              {t('footer.landing.becomeHost')}
            </Link>
          )}
          <LanguageSwitcher compact />

          {auth && (
            <div className="acc-header__auth">
              <Link to={auth.signupTo} className="acc-auth-btn acc-auth-btn--signup">
                {t('footer.signup')}
              </Link>
              <Link to={auth.loginTo} className="acc-auth-btn acc-auth-btn--login">
                {t('footer.login')}
              </Link>
            </div>
          )}

          {showMenu && (
            <div className="acc-nav-menu" ref={menuRef}>
              <button
                type="button"
                className="acc-nav-menu__btn"
                aria-label={t('landing.header.menuAria')}
                aria-expanded={menuOpen}
                aria-controls="acc-nav-menu-dropdown"
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name="menu" size={24} />
              </button>

              {menuOpen && (
                <div
                  id="acc-nav-menu-dropdown"
                  className="acc-user-menu__dropdown"
                  role="menu"
                  aria-label={t('landing.header.mainNav')}
                >
                  <span className="acc-user-menu__title">{t('landing.header.mainNav')}</span>
                  {navItems.map((item) =>
                    onItemClick ? (
                      <button
                        key={item.href}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onItemClick(item.href);
                          setMenuOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        key={item.href}
                        to={item.href}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                  {auth && (
                    <Link
                      to={auth.loginTo}
                      role="menuitem"
                      className="acc-user-menu__account"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('footer.login')}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
