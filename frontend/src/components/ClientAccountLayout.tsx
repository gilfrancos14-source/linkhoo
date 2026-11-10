import { useEffect, useState, type ReactNode } from 'react';
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
 */
export default function ClientAccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const homePath = useHomePath();
  const { getToken } = useAuth();

  const [collapsed] = useState(() => localStorage.getItem('client-sidebar') === 'true');

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  return (
    <div className={`admin client-account ${collapsed ? 'collapsed' : ''}`}>
      {/* Utiliser la nouvelle sidebar unifiée */}
      <ClientSidebar />
      
      <div className="admin-main client-main">
        <header className="topbar">
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
