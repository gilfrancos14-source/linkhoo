import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
// Chrome commun au back-office (sidebar, topbar) + styles de l'espace client.
import '../styles/18-admin.css';
import '../styles/23-client-compte.css';
import '../styles/client-sidebar.css';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';

import { setAuthTokenGetter } from '../lib/api';
import ClientNotificationBell from './ClientNotificationBell';
import ClientSidebar from './client/ClientSidebar';
import ClientSidebarToggle from './client/ClientSidebarToggle';
import { useClientSidebar } from '../lib/clientSidebarStore';

export type ClientSection = 'overview' | 'stays' | 'favorites' | 'profile' | 'messages';



function todayLabel(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Chrome de l'espace client (mêmes codes que le back-office gérant) : sidebar
 * repliable, groupe « Mon espace », topbar et zone de contenu. Partagé par
 * /compte et /messages pour que les deux pages aient le même design.
 *
 * Sur mobile, la sidebar est un tiroir hors écran ouvert par le bouton
 * hamburger de la topbar ; sur ordinateur, elle peut être réduite à un rail
 * (état mémorisé, comme dans l'espace gérant).
 */
export default function ClientAccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const homePath = useHomePath();
  const { getToken } = useAuth();
  const { open } = useClientSidebar();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  return (
    <div className={`admin client-account ${open ? 'mobile-open' : ''}`}>
      <ClientSidebar />

      <div className="admin-main client-main">
        <header className="topbar">
          <ClientSidebarToggle />

          <div className="topbar__right">
            <ClientNotificationBell />
            <span className="cdash-top__date">{todayLabel()}</span>
            <Link to={homePath} className="topbar__cta">Retour au site</Link>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
