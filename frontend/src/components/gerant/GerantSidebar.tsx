import { Link, NavLink } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import BrandLogo from '../BrandLogo';
import '../../styles/gerant-sidebar.css';

/**
 * Sidebar de l'espace gérant.
 *
 * Copie fidèle de la sidebar du tableau de bord (`/gerant`, maquette maq1),
 * extraite ici pour que TOUTES les pages du dashboard gérant partagent le
 * même menu (chambres, réservations, messages, vérification, profil,
 * premium, carte d'appel à l'abonnement).
 *
 * Les icônes s'appuient sur un sprite SVG privé (`#gsb-*`) : chaque page
 * embarque son propre sprite avec des ids du type `#home`, `#bed`… Préfixer
 * évite tout conflit de double définition d'id dans le document.
 *
 * Seule évolution par rapport à la sidebar d'origine : l'état actif est
 * dynamique (`NavLink`) — sur le tableau de bord, « Aperçu » était
 * systématiquement surligné même quand la page courante était ailleurs.
 */

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#gsb-${id}`} />
    </svg>
  );
}

/** Icônes utilisées par la sidebar (sprite privé, ids préfixés). */
function SidebarSprite() {
  return (
    <svg className="absolute h-0 w-0" aria-hidden="true">
      <symbol id="gsb-home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5" /></symbol>
      <symbol id="gsb-bed" viewBox="0 0 24 24"><path d="M3 20V5M3 16h18v4M21 16v-4a3 3 0 0 0-3-3h-7v7" /><circle cx="7" cy="11" r="1.5" /></symbol>
      <symbol id="gsb-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></symbol>
      <symbol id="gsb-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
      <symbol id="gsb-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" /></symbol>
      <symbol id="gsb-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></symbol>
      <symbol id="gsb-crown" viewBox="0 0 24 24"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z" fill="currentColor" /></symbol>
      <symbol id="gsb-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
      <symbol id="gsb-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="gsb-list" viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></symbol>
      <symbol id="gsb-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
      <symbol id="gsb-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
    </svg>
  );
}

const subClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'sub on' : 'sub');

export default function GerantSidebar() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const demandesPath = `${gerantPath}/reservations/demandes`;
  const chrome = useGerantChrome();

  return (
    <aside className="gerb sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 lg:flex">
      <SidebarSprite />

      <Link to={gerantPath} className="mb-6 flex items-center gap-2.5 px-2" aria-label="Linkhoo - retour à l'accueil">
        <BrandLogo />
      </Link>

      <nav className="space-y-3">
        <NavLink
          to={gerantPath}
          end
          className={({ isActive }) => (isActive ? 'grp grp--active rounded-xl' : 'grp')}
        >
          <Icon id="home" />Aperçu
        </NavLink>

        <div>
          <div className="grp"><Icon id="bed" />Chambres</div>
          <div className="pl-3">
            <NavLink to={chambresPath} end className={subClass}><Icon id="list" />Toutes les chambres</NavLink>
            <NavLink to={`${chambresPath}/ajouter`} className={subClass}><Icon id="plus" />Ajouter une chambre</NavLink>
          </div>
        </div>

        <div>
          <div className="grp"><Icon id="cal" />Réservations{chrome.reservationsCount > 0 && <span className="badge">{chrome.reservationsCount}</span>}</div>
          <div className="pl-3">
            <NavLink to={demandesPath} className={subClass}><Icon id="user" />Demandes</NavLink>
            <NavLink to={`${gerantPath}/reservations/calendrier`} className={subClass}><Icon id="cal" />Calendrier</NavLink>
          </div>
        </div>

        <div>
          <div className="grp"><Icon id="chat" />Messages{chrome.messagesUnread > 0 && <span className="badge">{chrome.messagesUnread}</span>}</div>
          <div className="pl-3">
            <NavLink to={`${gerantPath}/messages/boite-reception`} className={subClass}><Icon id="mail" />Boîte de réception</NavLink>
          </div>
        </div>

        <div>
          <div className="grp justify-between">
            <span className="flex items-center gap-3"><Icon id="shield" />Vérification</span>
            <Icon id="down" className="i !h-4 !w-4" />
          </div>
          <div className="pl-3">
            <NavLink to={`${gerantPath}/verification`} end className={subClass}><Icon id="doc" />Mes documents</NavLink>
            <NavLink to={`${gerantPath}/verification/suivi`} className={subClass}><Icon id="doc" />Suivi de vérification</NavLink>
          </div>
        </div>

        <div>
          <div className="grp justify-between">
            <span className="flex items-center gap-3"><Icon id="user" />Profil</span>
            <Icon id="down" className="i !h-4 !w-4" />
          </div>
          <div className="pl-3"><NavLink to={`${gerantPath}/profil`} className={subClass}><Icon id="user" />Mes informations</NavLink></div>
        </div>

        <div>
          <div className="grp"><Icon id="crown" className="i text-dash-brand" />Premium</div>
          <div className="pl-3"><NavLink to={`${gerantPath}/premium`} className={subClass}><Icon id="cal" />Mon abonnement</NavLink></div>
        </div>
      </nav>

      <div className="mt-auto rounded-2xl border border-orange-100 bg-dash-brand-soft p-4 pt-5">
        <p className="flex items-center gap-2 text-sm font-bold"><Icon id="crown" className="i h-5 w-5 text-dash-brand" />Passez au Premium</p>
        <p className="mt-2 text-[11px] text-slate-500">Plus de visibilité, plus de réservations !</p>
        <Link to={`${gerantPath}/premium`} className="mt-3 block rounded-lg bg-dash-brand py-2 text-center text-xs font-semibold text-white hover:bg-dash-brand-dark">Voir les avantages</Link>
      </div>
    </aside>
  );
}
