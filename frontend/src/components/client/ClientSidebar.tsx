import { Link, useLocation } from 'react-router-dom';
import '../../styles/client-sidebar.css';
import { useHomePath } from '../../hooks/useHomePath';
import { useClientUnread } from '../../hooks/useClientUnread';

/**
 * Sidebar unifiée pour toutes les pages client.
 *
 * Le balisage et les styles reprennent exactement la sidebar de la page
 * « Mes messages » (docs/maquettes/habici-mes-messages.html). Le sprite SVG
 * est embarqué dans le composant pour que les icônes s'affichent de la même
 * façon sur toutes les pages, quelle que soit la page visitée.
 */

function SidebarIcon({ id, className = '' }: { id: string; className?: string }) {
  return (
    <svg className={`ic ${className}`.trim()} aria-hidden="true">
      <use href={`#cs-${id}`} />
    </svg>
  );
}

/* Sprite local à la sidebar : identifiants `cs-*` pour ne pas entrer en
   collision avec les sprites `cm-*`, `cd-*` ou `cr-*` des pages. */
function SidebarSprite() {
  return (
    <svg className="hidden" aria-hidden="true">
      <symbol id="cs-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></symbol>
      <symbol id="cs-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></symbol>
      <symbol id="cs-msg" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
      <symbol id="cs-heart" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" /></symbol>
      <symbol id="cs-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
      <symbol id="cs-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></symbol>
      <symbol id="cs-help" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.5" y="14" width="4" height="6" rx="1.5" /><rect x="17.5" y="14" width="4" height="6" rx="1.5" /></symbol>
      <symbol id="cs-building" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></symbol>
      <symbol id="cs-building2" viewBox="0 0 24 24"><path d="M6 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 22h20M10 8h4M10 12h4M10 16h4" /></symbol>
    </svg>
  );
}

export default function ClientSidebar() {
  const homePath = useHomePath();
  const unreadMessages = useClientUnread();
  const { pathname, search } = useLocation();

  const view = new URLSearchParams(search).get('view');

  // Détermine l'entrée active. Les vues du compte sont distinguées par le
  // paramètre `view` : sans ça, « Accueil » resterait surligné partout.
  const isActive = (target: 'overview' | 'stays' | 'messages' | 'favorites' | 'profile' | 'settings') => {
    if (target === 'messages') return pathname.startsWith(`${homePath}/messages`);
    if (!pathname.startsWith(`${homePath}/compte`)) return false;
    if (target === 'overview') return view === null || view === 'overview';
    return view === target;
  };

  return (
    <>
      <SidebarSprite />

      <aside className="client-sidebar fixed inset-y-0 left-0 z-20 flex w-[247px] flex-col overflow-y-auto border-r border-[#e6ebf5] bg-white">
        <div className="flex h-[70px] flex-none items-center gap-2.5 px-[34px]">
          <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
        </div>

        <nav className="mt-3 space-y-[4px] px-[15px]">
          <Link
            to={`${homePath}/compte`}
            className={`nv ${isActive('overview') ? 'on' : ''}`}
            aria-current={isActive('overview') ? 'page' : undefined}
          >
            <SidebarIcon id="home" />Accueil
          </Link>
          <Link
            to={`${homePath}/compte?view=stays`}
            className={`nv ${isActive('stays') ? 'on' : ''}`}
            aria-current={isActive('stays') ? 'page' : undefined}
          >
            <SidebarIcon id="cal" />Mes séjours
          </Link>
          <Link
            to={`${homePath}/messages`}
            className={`nv ${isActive('messages') ? 'on' : ''}`}
            aria-current={isActive('messages') ? 'page' : undefined}
          >
            <SidebarIcon id="msg" />Messages
            {unreadMessages > 0 && (
              <span className="bd">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
            )}
          </Link>
          <Link
            to={`${homePath}/compte?view=favorites`}
            className={`nv ${isActive('favorites') ? 'on' : ''}`}
            aria-current={isActive('favorites') ? 'page' : undefined}
          >
            <SidebarIcon id="heart" />Mes favoris
          </Link>
          <Link
            to={`${homePath}/compte?view=profile`}
            className={`nv ${isActive('profile') ? 'on' : ''}`}
            aria-current={isActive('profile') ? 'page' : undefined}
          >
            <SidebarIcon id="user" />Mon profil
          </Link>
          <Link
            to={`${homePath}/compte?view=settings`}
            className={`nv ${isActive('settings') ? 'on' : ''}`}
            aria-current={isActive('settings') ? 'page' : undefined}
          >
            <SidebarIcon id="cog" />Paramètres
          </Link>
        </nav>

        <div className="mx-[18px] mt-[56px] rounded-xl border border-[#e6ebf5] bg-[#f5f8ff] p-3">
          <div className="flex gap-3">
            <SidebarIcon id="help" className="mt-1 !h-8 !w-8 flex-none text-[#1d3f8f]" />
            <div>
              <div className="text-[12.5px] font-bold">Besoin d'aide ?</div>
              <p className="mt-1 text-[11px] leading-[1.45] text-[#5f86d1]">
                Notre équipe est disponible pour vous accompagner.
              </p>
            </div>
          </div>
          <Link to="/contact" className="btn mt-3 !h-[34px] !text-[12px]">
            Contacter le support
          </Link>
        </div>

        <div className="mt-auto pb-12 text-center [@media(max-height:820px)]:hidden">
          <div className="flex items-end justify-center gap-0.5 text-blue-400">
            <SidebarIcon id="building" className="!h-10 !w-10 stroke-[1.2]" />
            <SidebarIcon id="building2" className="!h-16 !w-16 stroke-[1.2]" />
            <SidebarIcon id="building" className="!h-9 !w-9 stroke-[1.2]" />
          </div>
          <div className="text-[18px] font-extrabold tracking-tight text-[#1d3f8f]">
            Link<span className="text-[#ff5a14]">hoo</span>
          </div>
          <p className="mt-1 text-[13px] text-[#5f86d1]">Votre séjour, notre priorité !</p>
        </div>
      </aside>
    </>
  );
}
