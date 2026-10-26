import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Glyph, { glyphCalendar, glyphChat, glyphGrid, glyphLogout, glyphUser } from './Glyph';
import type { View } from './types';

const VIEWS: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: "Vue d'ensemble", icon: glyphGrid },
  { id: 'stays', label: 'Mes séjours', icon: glyphCalendar },
  { id: 'profile', label: 'Mon profil', icon: glyphUser },
];

/** Sidebar de l'espace client : identité, navigation, messages, déconnexion. */
export default function ClientSidebar({
  initials,
  displayName,
  email,
  memberSince,
  view,
  staysCount: staysCountProp,
  unreadMessages,
  homePath,
  onSelectView,
  onSignOut,
}: {
  initials: string;
  displayName: string;
  email: string;
  memberSince: string;
  view: View;
  staysCount: number;
  unreadMessages: number;
  homePath: string;
  onSelectView: (view: View) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="cdash-side">
      <Link to={homePath} className="cdash-side__logo" aria-label="Linkhoo - retour à l'accueil">
        <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
      </Link>

      <div className="cdash-side__brand">
        <span className="cdash-side__avatar" aria-hidden="true">{initials}</span>
        <div className="cdash-side__id">
          <p className="cdash-side__name">{displayName}</p>
          {email && <p className="cdash-side__email">{email}</p>}
        </div>
      </div>

      <nav className="cdash-side__nav" role="tablist" aria-label="Navigation de mon espace">
        {VIEWS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="cdash-panel"
              className={`cdash-nav${active ? ' is-active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <Glyph>{item.icon}</Glyph>
              <span className="cdash-nav__label">{item.label}</span>
              {item.id === 'stays' && staysCountProp > 0 && (
                <span className="cdash-nav__badge">{staysCountProp}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Hors tablist : page à part. */}
      <Link to={`${homePath}/messages`} className="cdash-nav cdash-nav--link">
        <Glyph>{glyphChat}</Glyph>
        <span className="cdash-nav__label">Messages</span>
        {unreadMessages > 0 && (
          <span className="cdash-nav__badge cdash-nav__badge--alert" aria-label={`${unreadMessages} non lus`}>
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </Link>

      <div className="cdash-side__foot">
        {memberSince && (
          <span className="cdash-side__member">Membre depuis {memberSince}</span>
        )}
        <button type="button" className="cdash-side__signout" onClick={onSignOut}>
          <Glyph>{glyphLogout}</Glyph>
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
