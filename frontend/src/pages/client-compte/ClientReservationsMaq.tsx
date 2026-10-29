import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { marketByCode, type MarketCode } from '../../config/markets';
import type { ClientMineReservationData, ReviewData } from '../../lib/api';
import { canPayReservation, paymentLabels } from '../../lib/reservations';
import { formatPrice } from '../../lib/roomDisplay';
import ReviewForm from './ReviewForm';
import type { ReviewFormState } from './types';

/**
 * Espace client — « Mes réservations ».
 * Conversion de docs/maquettes/habici-mes-reservations.html : le balisage et
 * les classes reprennent la maquette à l'identique (sidebar et topbar
 * incluses) ; seules les données viennent de l'API.
 */

const MARKET_CAPITALS: Record<MarketCode, string> = {
  CI: 'Abidjan',
  BJ: 'Cotonou',
  SN: 'Dakar',
  TG: 'Lomé',
  CM: 'Yaoundé',
  BF: 'Ouagadougou',
  CG: 'Brazzaville',
  GA: 'Libreville',
  GN: 'Conakry',
  ML: 'Bamako',
  NE: 'Niamey',
  CD: 'Kinshasa',
};

type StatutVisuel = 'confirmee' | 'en_cours' | 'terminee' | 'en_attente' | 'annulee';

const STATUT_STYLES: Record<StatutVisuel, { label: string; cls: string }> = {
  confirmee: { label: 'Confirmée', cls: 'ok' },
  en_cours: { label: 'En cours', cls: 'run' },
  terminee: { label: 'Terminée', cls: 'done' },
  en_attente: { label: 'En attente', cls: 'wait' },
  annulee: { label: 'Annulée', cls: 'off' },
};

function Icon({ id, className = '' }: { id: string; className?: string }) {
  return (
    <svg className={`ic ${className}`.trim()} aria-hidden="true">
      <use href={`#cr-${id}`} />
    </svg>
  );
}

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nightsOf(reservation: ClientMineReservationData): number {
  if (reservation.duree_nombre) return reservation.duree_nombre;
  const start = parseIsoDate(reservation.date_debut);
  const end = parseIsoDate(reservation.date_fin);
  if (!start || !end) return 1;
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Number.isFinite(nights) && nights > 0 ? nights : 1;
}

/** Suffixe « - Cocody » du titre d'annonce = la localisation affichée. */
function cityOf(reservation: ClientMineReservationData): string {
  const separator = reservation.room_title.indexOf(' - ');
  return separator > 0 ? reservation.room_title.slice(separator + 3) : '';
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'C';
}

/** Statut affiché sur la pastille : le statut serveur prime, les dates précisent. */
function visualStatut(reservation: ClientMineReservationData, todayIso: string): StatutVisuel {
  if (reservation.statut === 'annulee') return 'annulee';
  if (reservation.statut === 'en_attente') return 'en_attente';
  if (reservation.date_fin < todayIso) return 'terminee';
  if (reservation.date_debut <= todayIso) return 'en_cours';
  return 'confirmee';
}

/** Onglets : partition disjointe par rapport aux dates du séjour. */
type TabId = 'toutes' | 'avenir' | 'encours' | 'terminees' | 'annulees';

function tabOf(reservation: ClientMineReservationData, todayIso: string): TabId {
  if (reservation.statut === 'annulee') return 'annulees';
  if (reservation.date_debut > todayIso) return 'avenir';
  if (reservation.date_fin >= todayIso) return 'encours';
  return 'terminees';
}

export interface ClientReservationsMaqProps {
  displayName: string;
  profileFirstName: string;
  profileLastName: string;
  avatarUrl?: string | null;
  unreadMessages: number;
  reservations: ClientMineReservationData[];
  reviews: ReviewData[];
  loading: boolean;
  error: string;
  homePath: string;
  reviewsError: boolean;
  reviewable: ClientMineReservationData[];
  reviewedIds: Set<string | undefined>;
  reviewSuccess: string;
  reviewForm: ReviewFormState | null;
  reviewError: string;
  reviewSubmitting: boolean;
  cancellingId: string | null;
  payingId?: string | null;
  onCancel: (id: string) => void;
  onOpenReviewForm: (reservation: ClientMineReservationData) => void;
  onChangeReview: (patch: Partial<ReviewFormState>) => void;
  onCloseReview: () => void;
  onSubmitReview: (e: FormEvent) => void;
  onPay?: (reservation: ClientMineReservationData) => void;
}

export default function ClientReservationsMaq({
  displayName,
  profileFirstName,
  profileLastName,
  avatarUrl,
  unreadMessages,
  reservations,
  loading,
  error,
  homePath,
  reviewsError,
  reviewable,
  reviewedIds,
  reviewSuccess,
  reviewForm,
  reviewError,
  reviewSubmitting,
  cancellingId,
  payingId,
  onCancel,
  onChangeReview,
  onCloseReview,
  onSubmitReview,
  onPay,
}: ClientReservationsMaqProps) {
  const { market } = useMarket();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [tab, setTab] = useState<TabId>('toutes');
  const [periode, setPeriode] = useState('toutes');
  const [ville, setVille] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  const profilePath = `${homePath}/compte?view=profile`;
  const staysPath = `${homePath}/compte?view=stays`;
  const messagesPath = `${homePath}/messages`;
  const searchPath = `${homePath}/recherche`;
  const favoritesPath = `${homePath}/compte?view=favorites`;
  const marketLabel = marketByCode(market).label;
  const cityLabel = `${MARKET_CAPITALS[market]}, ${marketLabel}`;

  const fullName = [profileFirstName, profileLastName].filter(Boolean).join(' ') || displayName || 'Client';
  const todayIso = new Date().toISOString().slice(0, 10);

  const handleSignOut = async () => {
    await signOut();
    navigate(homePath);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `${searchPath}?q=${encodeURIComponent(trimmed)}` : searchPath);
  };

  const towns = useMemo(() => {
    const seen = new Set<string>();
    for (const reservation of reservations) {
      seen.add(cityOf(reservation) || cityLabel);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [reservations, cityLabel]);

  const counts = useMemo(() => {
    const result = { toutes: reservations.length, avenir: 0, encours: 0, terminees: 0, annulees: 0 };
    for (const reservation of reservations) result[tabOf(reservation, todayIso)] += 1;
    return result;
  }, [reservations, todayIso]);

  const filtered = useMemo(() => {
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    return reservations.filter((reservation) => {
      if (tab !== 'toutes' && tabOf(reservation, todayIso) !== tab) return false;
      if (ville && (cityOf(reservation) || cityLabel) !== ville) return false;
      if (statutFilter && visualStatut(reservation, todayIso) !== statutFilter) return false;
      if (periode === 'avenir') {
        if (reservation.statut === 'annulee' || reservation.date_fin < todayIso) return false;
      }
      if (periode === '30j' && (reservation.created_at ?? '').slice(0, 10) < monthAgo) return false;
      return true;
    });
  }, [reservations, tab, ville, statutFilter, periode, todayIso, cityLabel]);

  const upcoming = useMemo(
    () => reservations
      .filter((reservation) => reservation.statut !== 'annulee' && reservation.date_fin >= todayIso)
      .sort((a, b) => a.date_debut.localeCompare(b.date_debut)),
    [reservations, todayIso],
  );
  const nextThree = upcoming.slice(0, 3);

  const resetFilters = () => {
    setTab('toutes');
    setPeriode('toutes');
    setVille('');
    setStatutFilter('');
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'toutes', label: 'Toutes' },
    { id: 'avenir', label: 'À venir' },
    { id: 'encours', label: 'En cours' },
    { id: 'terminees', label: 'Terminées' },
    { id: 'annulees', label: 'Annulées' },
  ];

  const recap = [
    { label: 'Total des réservations', count: reservations.length, icon: 'caldays', cls: 'text-[#ff5a14]' },
    { label: 'À venir', count: counts.avenir, icon: 'calclock', cls: 'text-teal-500' },
    { label: 'En cours', count: counts.encours, icon: 'clock', cls: 'text-blue-600' },
    { label: 'Terminées', count: counts.terminees, icon: 'check', cls: 'fill-emerald-500 stroke-white' },
    { label: 'Annulées', count: counts.annulees, icon: 'x', cls: 'fill-red-500 stroke-white' },
  ];

  return (
    <div className="res-maq font-inter min-h-screen bg-[#f8faff] text-[#0b1b3f] antialiased">
      <svg className="hidden" aria-hidden="true">
        <symbol id="cr-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></symbol>
        <symbol id="cr-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></symbol>
        <symbol id="cr-msg" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
        <symbol id="cr-heart" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" /></symbol>
        <symbol id="cr-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
        <symbol id="cr-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></symbol>
        <symbol id="cr-help" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.5" y="14" width="4" height="6" rx="1.5" /><rect x="17.5" y="14" width="4" height="6" rx="1.5" /></symbol>
        <symbol id="cr-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></symbol>
        <symbol id="cr-bell" viewBox="0 0 24 24"><path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" /></symbol>
        <symbol id="cr-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
        <symbol id="cr-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></symbol>
        <symbol id="cr-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></symbol>
        <symbol id="cr-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></symbol>
        <symbol id="cr-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></symbol>
        <symbol id="cr-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z" /></symbol>
        <symbol id="cr-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
        <symbol id="cr-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></symbol>
        <symbol id="cr-x" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></symbol>
        <symbol id="cr-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></symbol>
        <symbol id="cr-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></symbol>
        <symbol id="cr-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z" /></symbol>
        <symbol id="cr-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
        <symbol id="cr-dots" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></symbol>
        <symbol id="cr-caldays" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></symbol>
        <symbol id="cr-calclock" viewBox="0 0 24 24"><path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M16 2v4M8 2v4M3 10h18" /><circle cx="18" cy="17" r="4" /><path d="M18 15v2l1.5 1" /></symbol>
        <symbol id="cr-building" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></symbol>
        <symbol id="cr-building2" viewBox="0 0 24 24"><path d="M6 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 22h20M10 8h4M10 12h4M10 16h4" /></symbol>
        <symbol id="cr-close" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></symbol>
        <symbol id="cr-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></symbol>
      </svg>

      {/* ============ SIDEBAR ============ */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[244px] flex-col overflow-y-auto border-r border-[#e6ebf5] bg-white">
        <div className="flex h-[70px] flex-none items-center gap-2.5 px-[36px]">
          <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
        </div>

        <nav className="mt-3 space-y-[6px] px-[17px]">
          <Link to={`${homePath}/compte`} className="nv">
            <Icon id="home" />Accueil
          </Link>
          <Link to={staysPath} className="nv on" aria-current="page">
            <Icon id="cal" />Mes réservations
            {reservations.length > 0 && (
              <span className="bd">{reservations.length > 9 ? '9+' : reservations.length}</span>
            )}
          </Link>
          <Link to={messagesPath} className="nv">
            <Icon id="msg" />Mes messages
            {unreadMessages > 0 && (
              <span className="bd">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
            )}
          </Link>
          <Link to={favoritesPath} className="nv">
            <Icon id="heart" />Mes favoris
          </Link>
          <Link to={profilePath} className="nv">
            <Icon id="user" />Mon profil
          </Link>
          <Link to={profilePath} className="nv">
            <Icon id="cog" />Paramètres
          </Link>
        </nav>

        <div className="mx-5 mt-[70px] rounded-xl border border-[#e6ebf5] bg-[#f5f8ff] p-3">
          <div className="flex gap-3">
            <Icon id="help" className="mt-1 h-8 w-8 flex-none text-[#1d3f8f]" />
            <div>
              <div className="text-[12.5px] font-bold">Besoin d’aide ?</div>
              <p className="mt-1 text-[11px] leading-[1.45] text-[#5f86d1]">
                Notre équipe est disponible pour vous accompagner.
              </p>
            </div>
          </div>
          <Link to="/contact" className="btn mt-3 !h-[34px] !text-[12px]">
            Contacter le support
          </Link>
        </div>

        <div className="mt-auto pb-12 text-center">
          <div className="flex items-end justify-center gap-0.5 text-blue-400">
            <Icon id="building" className="!h-10 !w-10 stroke-[1.2]" />
            <Icon id="building2" className="!h-16 !w-16 stroke-[1.2]" />
            <Icon id="building" className="!h-9 !w-9 stroke-[1.2]" />
          </div>
          <div className="text-[18px] font-extrabold tracking-tight text-[#1d3f8f]">
            Link<span className="text-[#ff5a14]">hoo</span>
          </div>
          <p className="mt-1 text-[13px] text-[#5f86d1]">Votre séjour, notre priorité !</p>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="ml-[244px]">
        <header className="flex h-[70px] items-center justify-between pl-[23px] pr-6">
          <form
            onSubmit={handleSearch}
            className="flex h-[38px] w-[588px] max-w-full items-center gap-3 rounded-lg border border-[#e6ebf5] bg-white px-4"
          >
            <Icon id="search" className="!h-[18px] !w-[18px] text-[#2f5bbf]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une chambre, une ville, une catégorie..."
              className="flex-1 appearance-none border-0 bg-transparent p-0 text-[12.5px] outline-none placeholder:text-[#5f86d1]"
            />
          </form>

          <div className="flex items-center gap-8">
            <Link to={messagesPath} className="relative" aria-label="Notifications">
              <Icon id="bell" className="text-[#2f5bbf]" />
              {unreadMessages > 0 && (
                <span className="absolute -right-2 -top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ff5a14] text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                className="flex h-[54px] w-[196px] items-center gap-3 rounded-xl border border-[#e6ebf5] bg-white pl-2 pr-4"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="avatar h-10 w-10">{initialsOf(fullName)}</span>
                )}
                <span className="min-w-0 text-left leading-tight">
                  <span className="block truncate text-[13px] font-semibold">{fullName}</span>
                  <span className="block text-[11px] text-[#5f86d1]">Client</span>
                </span>
                <Icon id="down" className="ml-auto !h-4 !w-4" />
              </button>

              {menuOpen && (
                <div className="user-menu" role="menu">
                  <Link to={profilePath} className="user-menu__item" role="menuitem">
                    <Icon id="user" className="!h-4 !w-4" />Mon profil
                  </Link>
                  <button
                    type="button"
                    className="user-menu__item"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    <Icon id="logout" className="!h-4 !w-4" />Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)_clamp(300px,25vw,388px)] max-xl:grid-cols-1">
          {/* ===== Colonne centrale ===== */}
          <main className="pb-8 pl-[23px] pr-[15px]">
            <div className="flex items-start justify-between pt-3">
              <div>
                <div className="flex items-center gap-3.5">
                  <span className="grid h-[36px] w-[36px] place-items-center rounded-lg border-2 border-[#1d3f8f] text-[#1d3f8f]">
                    <Icon id="cal" className="!h-5 !w-5" />
                  </span>
                  <h1 className="text-[28px] font-extrabold tracking-tight text-[#1d3f8f]">Mes réservations</h1>
                </div>
                <p className="mt-0.5 text-[15px] text-[#2f5bbf]">
                  Retrouvez toutes vos réservations et gérez vos séjours en toute simplicité.
                </p>
              </div>
              <Link
                to="/contact"
                className="flex h-[34px] shrink-0 items-center gap-2.5 rounded-lg border border-[#e6ebf5] bg-white px-4 text-[11.5px] font-semibold text-[#1d3f8f]"
              >
                <Icon id="info" className="!h-4 !w-4" />Besoin d’aide ?
              </Link>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600" role="alert">
                {error}
              </p>
            )}

            {reviewSuccess && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] text-emerald-700" role="status">
                {reviewSuccess}
              </p>
            )}

            {/* Onglets */}
            <div className="card mt-[21px] flex justify-around px-2">
              {tabs.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  aria-current={tab === entry.id ? 'true' : undefined}
                  className={`tab${tab === entry.id ? ' on' : ''}`}
                >
                  {entry.label}<b>{counts[entry.id]}</b>
                </button>
              ))}
            </div>

            {/* Filtres */}
            <div className="mt-[18px] grid grid-cols-[227fr_236fr_252fr_112fr] gap-2.5 max-lg:grid-cols-2">
              <label className="flt">
                <Icon id="cal" />
                <span className="sr-only">Période</span>
                <select
                  value={periode}
                  onChange={(event) => setPeriode(event.target.value)}
                  className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[12px] text-[#1d3f8f] outline-none"
                >
                  <option value="toutes">Toutes les dates</option>
                  <option value="avenir">À venir</option>
                  <option value="30j">30 derniers jours</option>
                </select>
              </label>

              <label className="flt">
                <Icon id="pin" />
                <span className="sr-only">Ville</span>
                <select
                  value={ville}
                  onChange={(event) => setVille(event.target.value)}
                  className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[12px] text-[#1d3f8f] outline-none"
                >
                  <option value="">Toutes les villes</option>
                  {towns.map((town) => (
                    <option key={town} value={town}>{town}</option>
                  ))}
                </select>
                <Icon id="down" />
              </label>

              <label className="flt">
                <Icon id="filter" />
                <span className="sr-only">Statut</span>
                <select
                  value={statutFilter}
                  onChange={(event) => setStatutFilter(event.target.value)}
                  className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[12px] text-[#1d3f8f] outline-none"
                >
                  <option value="">Tous les statuts</option>
                  <option value="confirmee">Confirmée</option>
                  <option value="en_cours">En cours</option>
                  <option value="terminee">Terminée</option>
                  <option value="en_attente">En attente</option>
                  <option value="annulee">Annulée</option>
                </select>
                <Icon id="down" />
              </label>

              <button
                type="button"
                onClick={resetFilters}
                className="flt justify-center font-medium"
              >
                <Icon id="refresh" />Réinitialiser
              </button>
            </div>

            {/* Liste */}
            <div className="mt-[21px] space-y-[10px]">
              {loading ? (
                <div className="card px-5 py-10 text-center text-[13px] text-[#5f86d1]">
                  Chargement de vos réservations…
                </div>
              ) : reservations.length === 0 ? (
                <div className="card px-5 py-12 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#fff1e8] text-[#ff5a14]">
                    <Icon id="cal" className="!h-7 !w-7" />
                  </span>
                  <p className="mt-4 text-[14px] font-semibold text-[#1d3f8f]">Aucune réservation pour le moment</p>
                  <p className="mt-1 text-[12px] text-[#5f86d1]">
                    Dès que vous réserverez un séjour, il apparaîtra ici avec son statut en temps réel.
                  </p>
                  <Link
                    to={homePath}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#ff5a14] px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#e04f08]"
                  >
                    Parcourir les appartements<Icon id="arrow" className="!h-4 !w-4" />
                  </Link>
                </div>
              ) : filtered.length === 0 ? (
                <div className="card px-5 py-10 text-center">
                  <p className="text-[14px] font-semibold text-[#1d3f8f]">
                    Aucune réservation ne correspond à vos filtres.
                  </p>
                  <button type="button" onClick={resetFilters} className="mt-2 text-[12px] font-medium text-[#2f5bbf] underline">
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                filtered.map((reservation) => {
                  const statut = visualStatut(reservation, todayIso);
                  const style = STATUT_STYLES[statut];
                  const nights = nightsOf(reservation);
                  const unit = reservation.duree_unite === 'mois' ? 'mois' : nights > 1 ? 'nuits' : 'nuit';
                  const total = reservation.montant ? reservation.montant * nights : null;
                  const paymentLabel = reservation.payment_status
                    ? paymentLabels[reservation.payment_status]
                    : null;
                  const canReview = !reviewsError && reviewable.some((x) => x.id === reservation.id);
                  const canPay = !!onPay && canPayReservation(reservation.payment_status);
                  const showSuivi = statut === 'en_cours';
                  const showPay = !showSuivi && canPay;
                  const showCancel = !showSuivi && !showPay && reservation.statut !== 'annulee';
                  const detailPath = reservation.room_id
                    ? `${homePath}/chambre/${reservation.room_id}`
                    : searchPath;

                  return (
                    <article className="rs" key={reservation.id}>
                      <div className="im">
                        {reservation.room?.img && (
                          <img
                            src={reservation.room.img}
                            alt={reservation.room.alt || reservation.room_title}
                            loading="lazy"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <Icon id="heart" className="absolute right-2.5 top-2.5 !h-6 !w-6 text-white" />
                      </div>

                      <div>
                        <h3>{reservation.room_title}</h3>
                        <p className="l">
                          <Icon id="pin" />{cityOf(reservation) || cityLabel}
                        </p>
                        <p className="l !mt-1.5">
                          <Icon id="cal" />
                          {formatShortDate(reservation.date_debut)}
                          <Icon id="arrow" className="!h-3.5 !w-3.5" />
                          {formatShortDate(reservation.date_fin)} ({nights} {unit})
                        </p>
                        <ul className="am">
                          {reservation.created_at && (
                            <li><Icon id="doc" />Demande du {formatShortDate(reservation.created_at)}</li>
                          )}
                          {paymentLabel && (
                            <li><Icon id="check" />{paymentLabel}</li>
                          )}
                        </ul>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`st ${style.cls}`}>
                            <Icon id={statut === 'annulee' ? 'x' : 'check'} />
                            {style.label}
                          </span>
                          <Icon id="dots" className="!h-5 !w-5 text-[#1d3f8f]" />
                        </div>
                        {reservation.montant ? (
                          <p className="pr"><b>{formatPrice(reservation.montant)}</b> FCFA / nuit</p>
                        ) : (
                          <p className="pr">
                            <span className="text-[12px] font-medium text-[#5f86d1]">Prix communiqué par le gérant</span>
                          </p>
                        )}
                        {total !== null && <p className="tt">Total : {formatPrice(total)} FCFA</p>}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to={detailPath} className="btn w-[120px]">Voir le détail</Link>
                          {showSuivi && (
                            <Link to={`${homePath}/suivi-reservation`} className="btn o flex-1">Voir le suivi</Link>
                          )}
                          {showPay && (
                            <button
                              type="button"
                              className="btn o flex-1"
                              disabled={payingId === reservation.id}
                              onClick={() => onPay?.(reservation)}
                            >
                              {payingId === reservation.id ? 'Paiement…' : 'Payer maintenant'}
                            </button>
                          )}
                          {showCancel && (
                            <button
                              type="button"
                              className="btn o flex-1"
                              disabled={cancellingId === reservation.id}
                              onClick={() => onCancel(reservation.id)}
                            >
                              {cancellingId === reservation.id ? 'Annulation…' : 'Annuler la réservation'}
                            </button>
                          )}
                          {canReview && (
                            <button type="button" className="btn flex-1" onClick={() => navigate(`${homePath}/avis/${reservation.id}`)}>
                              Laisser un avis
                            </button>
                          )}
                        </div>
                        {reviewedIds.has(reservation.id) && (
                          <p className="tt">Avis publié</p>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {!reviewsError && reviewable.length > 0 && !reviewForm && (
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-[12px] text-[#2f5bbf]">
                <Icon id="star" className="f !h-4 !w-4 text-amber-400" />
                Vous avez {reviewable.length} séjour(s) confirmé(s) que vous pouvez noter.
              </p>
            )}

            {reviewsError && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-700" role="status">
                Impossible de charger vos avis : le bouton « Laisser un avis » est masqué
                pour éviter de publier deux fois le même séjour.
              </p>
            )}
          </main>

          {/* ===== Panneau droit ===== */}
          <aside className="space-y-4 border-l border-[#e6ebf5] bg-white/70 px-5 pb-8 pt-[19px] max-xl:border-0">
            {/* Prochaines réservations */}
            <section className="card overflow-hidden pb-[14px]">
              <div className="relative flex h-[112px] items-start gap-3 bg-gradient-to-br from-[#0a1b45] to-[#2a4a7a] px-4 pt-[14px] text-white">
                {nextThree[0]?.room?.img && (
                  <img
                    src={nextThree[0].room.img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-50"
                  />
                )}
                <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-white/20">
                  <Icon id="cal" className="!h-5 !w-5" />
                </span>
                <h2 className="relative mt-1.5 text-[16px] font-semibold">Vos prochaines réservations</h2>
              </div>

              {nextThree.length > 0 ? (
                nextThree.map((reservation, index) => {
                  const style = STATUT_STYLES[visualStatut(reservation, todayIso)];
                  return (
                    <Link
                      key={`next-${reservation.id}`}
                      to={reservation.room_id ? `${homePath}/chambre/${reservation.room_id}` : staysPath}
                      className={`card relative mx-3 flex gap-3.5 !rounded-lg px-3.5 pb-3.5 pt-3.5 hover:bg-slate-50 ${index === 0 ? '-mt-[45px]' : 'mt-3'}`}
                    >
                      <div className="flex-none">
                        <div className="h-[72px] w-[79px] overflow-hidden rounded-md bg-gradient-to-br from-amber-200 to-orange-300">
                          {reservation.room?.img && (
                            <img
                              src={reservation.room.img}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <span className={`st ${style.cls} -ml-0.5 mt-2 !h-[22px] !text-[11px]`}>
                          {style.label}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pr-5">
                        <div className="truncate text-[12.5px] font-bold text-[#1d3f8f]">{reservation.room_title}</div>
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#5f86d1]">
                          <Icon id="pin" className="!h-3.5 !w-3.5 text-[#2f5bbf]" />{cityOf(reservation) || cityLabel}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#5f86d1]">
                          <Icon id="cal" className="!h-3.5 !w-3.5 text-[#2f5bbf]" />
                          {formatShortDate(reservation.date_debut)}
                          <Icon id="arrow" className="!h-3 !w-3" />
                          {formatShortDate(reservation.date_fin)}
                        </p>
                        {reservation.montant && (
                          <p className="mt-3 text-[11.5px] font-semibold">
                            <b className="text-[13px] font-extrabold">{formatPrice(reservation.montant)}</b> FCFA / nuit
                          </p>
                        )}
                      </div>
                      <Icon id="right" className="absolute right-3 top-[56px] !h-4 !w-4 text-[#1d3f8f]" />
                    </Link>
                  );
                })
              ) : (
                <p className="px-4 pb-2 pt-4 text-center text-[12px] text-[#5f86d1]">
                  {loading ? 'Chargement…' : 'Aucune réservation à venir pour le moment.'}
                </p>
              )}
            </section>

            {/* Récapitulatif */}
            <section className="card px-5 py-5">
              <h2 className="flex items-center gap-3.5 text-[17px] font-bold text-[#1d3f8f]">
                <Icon id="cal" className="!h-[26px] !w-[26px] text-[#2f5bbf]" />Récapitulatif
              </h2>
              <div className="mt-3">
                {recap.map((row) => (
                  <div className="rc" key={row.label}>
                    <Icon id={row.icon} className={row.cls} />{row.label}<b>{row.count}</b>
                  </div>
                ))}
              </div>
            </section>

            {/* Question */}
            <section className="card mt-5 p-[7px]">
              <div className="rounded-lg border border-orange-200/70 bg-[#fff3ec] p-3.5">
                <div className="flex gap-3.5">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-[#ff5a14] text-white">
                    <Icon id="calclock" className="!h-6 !w-6" />
                  </span>
                  <div>
                    <h3 className="text-[13.5px] font-bold text-[#ff5a14]">Une question sur votre réservation ?</h3>
                    <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[#5f86d1]">
                      Notre équipe est là pour vous aider en cas de besoin.
                    </p>
                  </div>
                </div>
                <Link to="/contact" className="btn ml-[54px] mt-3 w-[166px] !h-[32px]">
                  Contacter le support
                </Link>
              </div>
            </section>

            {/* Conseils */}
            <section className="card px-5 py-4">
              <div className="flex items-center gap-3.5 text-[15px] font-bold text-[#1d3f8f]">
                <Icon id="bulb" className="!h-[26px] !w-[26px] text-[#2f5bbf]" />Conseils de voyage
                <Icon id="right" className="ml-auto !h-4 !w-4" />
              </div>
              <div className="mt-4 flex gap-4">
                <div className="h-[98px] w-[100px] flex-none overflow-hidden rounded-md bg-gradient-to-b from-sky-300 to-amber-100">
                  <img
                    src="/images/1.jpg"
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div className="pt-2">
                  <div className="text-[12.5px] font-bold text-[#1d3f8f]">
                    Préparez votre séjour à {MARKET_CAPITALS[market]}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-[1.5] text-[#5f86d1]">
                    Découvrez nos conseils pour un séjour réussi et sans stress.
                  </p>
                  <Link to={homePath} className="mt-3 flex items-center gap-2 text-[11.5px] font-semibold text-[#2f5bbf]">
                    Voir les conseils<Icon id="arrow" className="!h-3.5 !w-3.5" />
                  </Link>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {reviewForm && (
        <ReviewForm
          form={reviewForm}
          error={reviewError}
          submitting={reviewSubmitting}
          onChange={onChangeReview}
          onClose={onCloseReview}
          onSubmit={onSubmitReview}
        />
      )}
    </div>
  );
}
