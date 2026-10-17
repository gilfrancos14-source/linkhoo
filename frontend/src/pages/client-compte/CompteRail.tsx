import { Link } from 'react-router-dom';
import type { Tab } from './types';

/** Rail latéral de l'espace client : identité, onglets, messages, déconnexion. */
export default function CompteRail({
  initials,
  displayName,
  email,
  tabs,
  tab,
  unreadMessages,
  memberSince,
  homePath,
  onSelectTab,
  onSignOut,
}: {
  initials: string;
  displayName: string;
  email: string;
  tabs: { id: Tab; label: string; count: number }[];
  tab: Tab;
  unreadMessages: number;
  memberSince: string;
  homePath: string;
  onSelectTab: (tab: Tab) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="compte-rail" aria-label="Mon espace">
      <div className="compte-rail__identity">
        <span className="compte-rail__avatar" aria-hidden="true">{initials}</span>
        <div className="compte-rail__id">
          <p className="compte-rail__name">{displayName}</p>
          {email && <p className="compte-rail__email">{email}</p>}
        </div>
      </div>

      <nav className="compte-rail__nav" role="tablist" aria-label="Sections de mon espace">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="cp-panel"
              className={`compte-rail__link${active ? ' is-active' : ''}`}
              onClick={() => onSelectTab(t.id)}
            >
              {t.label}
              {t.count > 0 && <span className="compte-rail__pill">{t.count}</span>}
            </button>
          );
        })}
      </nav>

      {/* Hors tablist : ce n'est pas un onglet mais une page à part. */}
      <Link to={`${homePath}/messages`} className="compte-rail__link">
        Messages
        {unreadMessages > 0 && (
          <span className="compte-rail__pill" aria-label={`${unreadMessages} non lus`}>
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </Link>

      <div className="compte-rail__footer">
        {memberSince && (
          <span className="compte-rail__badge">Membre depuis {memberSince}</span>
        )}
        <button type="button" className="compte-rail__signout" onClick={onSignOut}>
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
