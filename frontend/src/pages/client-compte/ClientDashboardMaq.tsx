import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { marketByCode, type MarketCode } from '../../config/markets';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import { apiMessages, type ClientMineReservationData, type Conversation, type FavoriteRoomData, type ReviewData } from '../../lib/api';
import { statutLabels } from '../../lib/reservations';
import { formatPrice, priceWithCurrency } from '../../lib/roomDisplay';

/**
 * Tableau de bord client — conversion de docs/maquettes/index.html.
 * Le balisage et les classes reprennent la maquette à l'identique ; seules
 * les données (profil, réservations, avis, messages non lus) sont branchées
 * sur l'API de l'espace client.
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

const STATUS_PILLS: Record<string, string> = {
  confirmee: 'text-emerald-700 border-emerald-300',
  en_attente: 'text-orange-600 border-orange-300',
  annulee: 'text-slate-600 border-slate-300',
};

function Icon({ id, className = '' }: { id: string; className?: string }) {
  return (
    <svg className={`ic ${className}`.trim()} aria-hidden="true">
      <use href={`#cd-${id}`} />
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

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  const picker = input as HTMLInputElement & { showPicker?: () => void };
  if (typeof picker.showPicker === 'function') {
    try {
      picker.showPicker();
      return;
    } catch {
      // Certains navigateurs refusent showPicker hors geste direct.
    }
  }
  input.focus();
}

function stayDates(reservation: ClientMineReservationData): string {
  const nights = nightsOf(reservation);
  const unit = reservation.duree_unite === 'mois'
    ? 'mois'
    : nights > 1
      ? 'nuits'
      : 'nuit';
  return `${formatShortDate(reservation.date_debut)} → ${formatShortDate(reservation.date_fin)} (${nights} ${unit})`;
}

function locationOf(reservation: ClientMineReservationData, fallback: string): string {
  const separator = reservation.room_title.indexOf(' - ');
  return separator > 0 ? reservation.room_title.slice(separator + 3) : fallback;
}

/** Titre court, sans le suffixe « - Quartier » ajouté par les annonces. */
function titleOf(reservation: ClientMineReservationData): string {
  const separator = reservation.room_title.indexOf(' - ');
  return separator > 0 ? reservation.room_title.slice(0, separator) : reservation.room_title;
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

function monthKey(value: string | null | undefined): string {
  return (value ?? '').slice(0, 7);
}

function isThisMonth(value: string | null | undefined): boolean {
  if (!value) return false;
  const now = new Date();
  return monthKey(value) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface ClientDashboardMaqProps {
  displayName: string;
  email: string;
  profileFirstName: string;
  profileLastName: string;
  phone: string;
  avatarUrl?: string | null;
  reservations: ClientMineReservationData[];
  favorites: FavoriteRoomData[];
  reviews: ReviewData[];
  unreadMessages: number;
  loading: boolean;
  error: string;
  homePath: string;
}

export default function ClientDashboardMaq({
  displayName,
  email,
  profileFirstName,
  profileLastName,
  phone,
  avatarUrl,
  reservations,
  favorites,
  reviews,
  unreadMessages,
  loading,
  error,
  homePath,
}: ClientDashboardMaqProps) {
  const { market } = useMarket();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Messages récents : dernières conversations réelles du client (inbox).
  const [conversations, setConversations] = useState<Conversation[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiMessages
      .inbox()
      .then((page) => {
        if (!cancelled) setConversations(page.items);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const latestConversation = useMemo(() => {
    const sorted = [...conversations].sort((a, b) => {
      const at = a.last_message_at ?? a.created_at;
      const bt = b.last_message_at ?? b.created_at;
      return (bt || '').localeCompare(at || '');
    });
    return sorted[0] ?? null;
  }, [conversations]);

  // Formulaire de recherche du hero : mêmes critères que la page /recherche
  // du site (destination, dates, catégorie).
  const [heroDestination, setHeroDestination] = useState('');
  const [heroArrivee, setHeroArrivee] = useState('');
  const [heroDepart, setHeroDepart] = useState('');
  const [heroCategory, setHeroCategory] = useState('');
  const [heroError, setHeroError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const heroArriveeRef = useRef<HTMLInputElement>(null);
  const heroDepartRef = useRef<HTMLInputElement>(null);

  // La maquette n'affiche pas la barre d'accent marché du site : on la masque
  // uniquement pendant la durée de vie du tableau de bord.
  useEffect(() => {
    document.documentElement.classList.add('cdash-hide-market-bar');
    return () => document.documentElement.classList.remove('cdash-hide-market-bar');
  }, []);

  // Les identifiants de catégories sont préfixés par le marché : on recharge
  // la liste et on réinitialise la sélection quand le marché change.
  useEffect(() => {
    let alive = true;
    setHeroCategory('');
    fetchCategoriesByMarket(market)
      .then((data) => {
        if (alive) setCategories(data);
      })
      .catch(() => {
        if (alive) setCategories([]);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  const profilePath = `${homePath}/compte?view=profile`;
  const staysPath = `${homePath}/compte?view=stays`;
  const messagesPath = `${homePath}/messages`;
  const searchPath = `${homePath}/recherche`;
  const favoritesPath = `${homePath}/compte?view=favorites`;
  const marketLabel = marketByCode(market).label;
  const cityLabel = `${MARKET_CAPITALS[market]}, ${marketLabel}`;

  const fullName = [profileFirstName, profileLastName].filter(Boolean).join(' ') || displayName || 'Client';

  const todayIso = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(
    () => reservations
      .filter((reservation) => reservation.statut !== 'annulee' && reservation.date_debut >= todayIso)
      .sort((a, b) => a.date_debut.localeCompare(b.date_debut)),
    [reservations, todayIso],
  );

  const uniqueRooms = useMemo(() => {
    const seen = new Set<string>();
    return [...reservations]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .filter((reservation) => {
        const key = reservation.room_id ?? reservation.room_title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [reservations]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    const total = reviews.reduce((sum, review) => sum + review.note_appartement, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const roomRating = (roomId: string | null | undefined) => {
    const roomReviews = reviews.filter((review) => review.room_id === roomId);
    if (!roomReviews.length) return null;
    const total = roomReviews.reduce((sum, review) => sum + review.note_appartement, 0);
    return {
      average: Math.round((total / roomReviews.length) * 10) / 10,
      count: roomReviews.length,
    };
  };

  const totalReservations = reservations.length;
  const totalThisMonth = reservations.filter((reservation) => isThisMonth(reservation.created_at)).length;
  const upcomingThisMonth = upcoming.filter((reservation) => isThisMonth(reservation.created_at)).length;
  const favoritesThisMonth = favorites.filter((favorite) => isThisMonth(favorite.favorited_at)).length;
  const favoriteCount = favorites.length;
  const nextThree = upcoming.slice(0, 3);
  const recentlyViewed = uniqueRooms.slice(0, 4);
  const favoriteRooms = favorites.slice(0, 3);

  const handleSignOut = async () => {
    await signOut();
    navigate(homePath);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `${searchPath}?q=${encodeURIComponent(trimmed)}` : searchPath);
  };

  const handleHeroSearch = (event: FormEvent) => {
    event.preventDefault();
    if (heroArrivee !== '' && heroDepart !== '' && heroDepart <= heroArrivee) {
      setHeroError('La date de départ doit être postérieure à la date d’arrivée.');
      return;
    }
    if ((heroArrivee === '') !== (heroDepart === '')) {
      setHeroError('Renseignez la date d’arrivée et la date de départ.');
      return;
    }
    setHeroError('');

    const params = new URLSearchParams();
    const destination = heroDestination.trim();
    if (destination) params.set('q', destination);
    if (heroArrivee) params.set('arrivee', heroArrivee);
    if (heroDepart) params.set('depart', heroDepart);
    if (heroCategory) params.set('categorie', heroCategory);
    const search = params.toString();
    navigate(`${searchPath}${search ? `?${search}` : ''}`);
  };

  return (
    <div className="cdash-maq font-inter flex min-h-screen bg-slate-50 text-slate-800 antialiased leading-normal">
      <svg className="hidden" aria-hidden="true">
        <symbol id="cd-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></symbol>
        <symbol id="cd-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></symbol>
        <symbol id="cd-msg" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
        <symbol id="cd-heart" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" /></symbol>
        <symbol id="cd-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
        <symbol id="cd-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></symbol>
        <symbol id="cd-help" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.5" y="14" width="4" height="6" rx="1.5" /><rect x="17.5" y="14" width="4" height="6" rx="1.5" /></symbol>
        <symbol id="cd-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></symbol>
        <symbol id="cd-bell" viewBox="0 0 24 24"><path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" /></symbol>
        <symbol id="cd-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
        <symbol id="cd-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></symbol>
        <symbol id="cd-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></symbol>
        <symbol id="cd-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></symbol>
        <symbol id="cd-bed" viewBox="0 0 24 24"><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.5" /></symbol>
        <symbol id="cd-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></symbol>
        <symbol id="cd-shield" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></symbol>
        <symbol id="cd-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></symbol>
        <symbol id="cd-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></symbol>
        <symbol id="cd-crown" viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></symbol>
        <symbol id="cd-up" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9" /></symbol>
        <symbol id="cd-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6" /></symbol>
        <symbol id="cd-close" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></symbol>
        <symbol id="cd-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></symbol>
      </svg>

      <div className="flex min-h-screen w-full">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ============ SIDEBAR ============ */}
        <aside
          className={`${mobileOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 w-[237px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:flex`}
        >
          <button
            type="button"
            className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <Icon id="close" className="h-5 w-5" />
          </button>

          <Link to={homePath} className="mb-6 flex items-center gap-2 px-2" aria-label="Linkhoo - retour à l'accueil">
            <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
          </Link>

          <nav className="space-y-1">
            <Link to={`${homePath}/compte`} className="nav is-active" aria-current="page">
              <Icon id="home" className="f" />Accueil
            </Link>
            <Link to={staysPath} className="nav">
              <Icon id="cal" />Mes réservations
            </Link>
            <Link to={messagesPath} className="nav">
              <Icon id="msg" />Mes messages
              {unreadMessages > 0 && (
                <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-habi text-[10px] font-semibold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
            <Link to={favoritesPath} className="nav">
              <Icon id="heart" />Mes favoris
            </Link>
            <Link to={profilePath} className="nav">
              <Icon id="user" />Mon profil
            </Link>
            <Link to={profilePath} className="nav">
              <Icon id="cog" />Paramètres
            </Link>
          </nav>

          <div className="mt-auto">
            <div className="border-t border-slate-200 pt-5 pb-4">
              <div className="mb-3 flex gap-3 px-1">
                <Icon id="help" className="h-7 w-7 text-navy" />
                <div>
                  <p className="text-[13px] font-semibold text-navy">Besoin d’aide ?</p>
                  <p className="text-[11px] leading-snug text-blue-700">
                    Notre équipe est disponible pour vous accompagner.
                  </p>
                </div>
              </div>
              <Link to="/contact" className="btn-o !py-2.5 !border-blue-300">
                Contacter le support
              </Link>
            </div>

            <div className="rounded-xl bg-navy p-4 text-white">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon id="crown" className="f h-6 w-6 text-amber-400" />
                Sécurisez votre réservation
              </p>
              <p className="mt-3 text-xs leading-snug text-slate-200">
                Accédez à plus de choix, plus d’avantages.
              </p>
              <div className="mt-3 rounded-lg bg-white/10 p-3 text-[11px] leading-snug text-slate-100">
                En réservant via la plateforme et en payant les frais de séjour, vous
                bénéficiez d’une protection : en cas d’annulation, le remboursement est
                pris en charge.
              </div>
            </div>
          </div>
        </aside>

        {/* ============ CONTENU ============ */}
        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <header className="flex h-[60px] items-center gap-4 border-b border-slate-100 bg-white/70 px-4 sm:px-6">
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-blue-700 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Icon id="search" className="hidden" />
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <form
              onSubmit={handleSearch}
              className="flex h-9 w-full max-w-[520px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-slate-400"
            >
              <Icon id="search" className="h-4 w-4 text-blue-700" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une chambre, une ville, une catégorie…"
                className="w-full appearance-none border-0 bg-transparent p-0 text-xs outline-none placeholder:text-slate-400"
              />
            </form>

            <Link
              to={messagesPath}
              className="relative ml-auto shrink-0 text-blue-700"
              aria-label="Notifications"
            >
              <Icon id="bell" className="h-6 w-6" />
              {unreadMessages > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-habi text-[9px] font-semibold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>

            <div className="relative shrink-0">
              <button
                type="button"
                className="card flex items-center gap-3 py-2 pl-3 pr-4"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="avatar h-9 w-9 text-xs">{initialsOf(fullName)}</span>
                )}
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-xs font-semibold text-navy">{fullName}</span>
                  <span className="block text-[11px] text-slate-400">Client</span>
                </span>
                <Icon id="down" className="ml-1 h-4 w-4 sm:ml-6" />
              </button>

              {menuOpen && (
                <div className="user-menu" role="menu">
                  <Link to={profilePath} className="user-menu__item" role="menuitem">
                    <Icon id="user" className="h-4 w-4" />Mon profil
                  </Link>
                  <button
                    type="button"
                    className="user-menu__item"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    <Icon id="logout" className="h-4 w-4" />Déconnexion
                  </button>
                </div>
              )}
            </div>
          </header>

          <main className="grid items-start gap-6 p-6 xl:grid-cols-[1fr_368px]">
            {/* ========== COLONNE GAUCHE ========== */}
            <div className="min-w-0 space-y-5">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}

              {/* Hero */}
              <section className="relative flex min-h-[252px] flex-col justify-between overflow-hidden rounded-xl bg-navy-900 text-white">
                <img
                  src="/images/pexels-artbovich-7214173.webp"
                  alt=""
                  className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-right"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-navy-900 from-35% via-navy/80 via-55% to-transparent" />
                <div className="relative p-6 pb-0">
                  <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-navy">
                    Bienvenue sur Linkhoo !
                  </span>
                  <h1 className="mt-3 text-3xl font-bold leading-tight">
                    Votre prochain séjour<br />commence ici
                  </h1>
                  <p className="mt-3 max-w-md text-sm font-medium leading-snug">
                    Découvrez des chambres confortables, sécurisées et au meilleur prix partout en Afrique.
                  </p>
                </div>
                <div className="absolute right-3 top-3 hidden items-center gap-3 rounded-lg border border-white/20 bg-navy-900/70 px-4 py-3 backdrop-blur md:flex">
                  <Icon id="shield" className="h-6 w-6" />
                  <div>
                    <p className="text-xs font-semibold">Réservation sécurisée</p>
                    <p className="text-[11px] text-slate-200">Vos informations sont protégées.</p>
                  </div>
                </div>

                <form
                  onSubmit={handleHeroSearch}
                  noValidate
                  className="relative m-6 mt-6 flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 pl-5 text-slate-800"
                >
                  <div className="flex min-w-[170px] flex-1 items-center gap-3 py-1">
                    <Icon id="pin" className="text-habi" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-destination"
                        className="block text-[11px] font-semibold text-navy"
                      >
                        Où souhaitez-vous séjourner ?
                      </label>
                      <input
                        id="cdash-destination"
                        type="text"
                        value={heroDestination}
                        onChange={(event) => setHeroDestination(event.target.value)}
                        placeholder="Ville, quartier…"
                        className="block w-full appearance-none border-0 bg-transparent p-0 text-[10px] text-slate-700 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="flex min-w-[170px] flex-1 items-center gap-3 border-slate-200 py-1 md:border-l md:pl-4">
                    <Icon id="cal" className="text-blue-700" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-arrivee"
                        className="block text-[11px] font-semibold text-navy"
                      >
                        Arrivée
                      </label>
                      <button
                        type="button"
                        id="cdash-arrivee"
                        onClick={() => openDatePicker(heroArriveeRef.current)}
                        className="block w-full truncate border-0 bg-transparent p-0 text-left text-[10px] leading-[15px] text-slate-700"
                      >
                        {heroArrivee ? formatShortDate(heroArrivee) : 'Choisir une date'}
                      </button>
                      <input
                        ref={heroArriveeRef}
                        type="date"
                        min={todayIso}
                        tabIndex={-1}
                        aria-label="Date d’arrivée"
                        value={heroArrivee}
                        onChange={(event) => {
                          setHeroArrivee(event.target.value);
                          if (heroError) setHeroError('');
                        }}
                        className="sr-only"
                      />
                    </div>
                  </div>
                  <div className="flex min-w-[170px] flex-1 items-center gap-3 border-slate-200 py-1 md:border-l md:pl-4">
                    <Icon id="cal" className="text-blue-700" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-depart"
                        className="block text-[11px] font-semibold text-navy"
                      >
                        Départ
                      </label>
                      <button
                        type="button"
                        id="cdash-depart"
                        onClick={() => openDatePicker(heroDepartRef.current)}
                        className="block w-full truncate border-0 bg-transparent p-0 text-left text-[10px] leading-[15px] text-slate-700"
                      >
                        {heroDepart ? formatShortDate(heroDepart) : 'Choisir une date'}
                      </button>
                      <input
                        ref={heroDepartRef}
                        type="date"
                        min={heroArrivee || todayIso}
                        tabIndex={-1}
                        aria-label="Date de départ"
                        value={heroDepart}
                        onChange={(event) => {
                          setHeroDepart(event.target.value);
                          if (heroError) setHeroError('');
                        }}
                        className="sr-only"
                      />
                    </div>
                  </div>
                  <div className="flex min-w-[170px] flex-1 items-center gap-3 border-slate-200 py-1 md:border-l md:pl-4">
                    <Icon id="bed" className="text-blue-700" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-category"
                        className="block text-[11px] font-semibold text-navy"
                      >
                        Catégorie
                      </label>
                      <select
                        id="cdash-category"
                        value={heroCategory}
                        onChange={(event) => setHeroCategory(event.target.value)}
                        className="block w-full appearance-none border-0 bg-transparent p-0 text-[10px] text-slate-700 outline-none"
                      >
                        <option value="">Toutes les catégories</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Icon id="down" className="mr-2 h-4 w-4" />
                  </div>
                  <button
                    type="submit"
                    className="flex h-11 items-center justify-center gap-2 rounded-lg bg-habi px-9 text-xs font-semibold text-white hover:bg-habi-dark"
                  >
                    <Icon id="search" className="h-4 w-4" />Rechercher
                  </button>
                  {heroError && (
                    <p role="alert" className="basis-full pl-1 pt-1 text-[11px] font-medium text-red-600">
                      {heroError}
                    </p>
                  )}
                </form>
              </section>

              {/* Stats */}
              <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="card p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500 text-white">
                    <Icon id="bed" />
                  </span>
                  <p className="mt-2 text-2xl font-bold text-navy">{totalReservations}</p>
                  <p className="text-xs text-slate-600">Réservations totales</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
                    <Icon id="up" className="!h-3 !w-3" />+{totalThisMonth} ce mois-ci
                  </p>
                </div>
                <div className="card p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-white">
                    <Icon id="cal" />
                  </span>
                  <p className="mt-2 text-2xl font-bold text-navy">{upcoming.length}</p>
                  <p className="text-xs text-slate-600">Séjours à venir</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
                    <Icon id="up" className="!h-3 !w-3" />+{upcomingThisMonth} ce mois-ci
                  </p>
                </div>
                <div className="card p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500 text-white">
                    <Icon id="heart" className="f" />
                  </span>
                  <p className="mt-2 text-2xl font-bold text-navy">{favoriteCount}</p>
                  <p className="text-xs text-slate-600">Chambres favorites</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
                    <Icon id="up" className="!h-3 !w-3" />+{favoritesThisMonth} ce mois-ci
                  </p>
                </div>
                <div className="card p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500 text-white">
                    <Icon id="star" className="f" />
                  </span>
                  <p className="mt-2 text-2xl font-bold text-navy">
                    {averageRating !== null ? averageRating.toFixed(1) : '—'}
                  </p>
                  <p className="text-xs text-slate-600">Note moyenne</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {reviews.length > 0
                      ? `Basée sur ${reviews.length} avis`
                      : 'Aucun avis pour le moment'}
                  </p>
                </div>
              </section>

              {/* Prochaines réservations */}
              <section className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-3 text-base font-semibold text-navy">
                    <Icon id="cal" className="text-blue-700" />Vos prochaines réservations
                  </h2>
                  <Link to={staysPath} className="link">
                    Voir toutes mes réservations<Icon id="arrow" className="!h-3.5 !w-3.5" />
                  </Link>
                </div>

                {nextThree.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {nextThree.map((reservation, index) => (
                      <article className="card p-2.5" key={reservation.id}>
                        <div className={`relative h-[105px] rounded-lg r${(index % 4) + 1}`}>
                          {reservation.room?.img && (
                            <img
                              src={reservation.room.img}
                              alt={reservation.room.alt || reservation.room_title}
                              className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
                              loading="lazy"
                              onError={(event) => { event.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span className={`pill ${STATUS_PILLS[reservation.statut] ?? 'text-slate-600 border-slate-300'}`}>
                            {statutLabels[reservation.statut] || reservation.statut}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-navy">{reservation.room_title}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Icon id="pin" className="!h-3.5 !w-3.5 text-blue-700" />
                          {locationOf(reservation, cityLabel)}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Icon id="cal" className="!h-3.5 !w-3.5 text-blue-700" />
                          {stayDates(reservation)}
                        </p>
                        <p className="mb-3 mt-2.5 text-sm font-bold text-navy">
                          {reservation.montant ? (
                            <>
                              {formatPrice(reservation.montant)} FCFA <span className="text-xs">/ nuit</span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-slate-500">Prix communiqué par le gérant</span>
                          )}
                        </p>
                        <Link to={staysPath} className="btn-o">Voir le détail</Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
                    <Icon id="cal" className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-navy">
                      {loading ? 'Chargement de vos réservations…' : 'Aucune réservation à venir'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Explorez les chambres disponibles et préparez votre prochain séjour.
                    </p>
                    <Link
                      to={homePath}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-habi px-5 py-2.5 text-xs font-semibold text-white hover:bg-habi-dark"
                    >
                      Parcourir les chambres<Icon id="arrow" className="!h-4 !w-4" />
                    </Link>
                  </div>
                )}
              </section>

              {/* Récemment consultées */}
              <section className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-navy">Chambres récemment consultées</h2>
                  <Link to={searchPath} className="link">
                    Voir toutes les chambres<Icon id="arrow" className="!h-3.5 !w-3.5" />
                  </Link>
                </div>

                {recentlyViewed.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {recentlyViewed.map((reservation, index) => {
                      const rating = roomRating(reservation.room_id);
                      return (
                        <article className="card p-2" key={reservation.room_id ?? reservation.id}>
                          <div className={`relative h-[52px] rounded-md r${(index % 4) + 1}`}>
                            {reservation.room?.img && (
                              <img
                                src={reservation.room.img}
                                alt={reservation.room.alt || reservation.room_title}
                                className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
                                loading="lazy"
                                onError={(event) => { event.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            <span className="heart">
                              <Icon id="heart" className="!h-3.5 !w-3.5 text-slate-400" />
                            </span>
                          </div>
                          <h3 className="mt-2 text-[11px] font-semibold text-navy">{titleOf(reservation)}</h3>
                          <p className="text-[10px] text-slate-500">{locationOf(reservation, cityLabel)}</p>
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                            <Icon id="star" className="f !h-3 !w-3 text-orange-400" />
                            <b className="font-semibold text-orange-500">
                              {rating ? rating.average.toFixed(1) : '—'}
                            </b>
                            ({rating ? rating.count : 0} avis)
                          </p>
                          <p className="mt-1.5 text-[11px] font-bold text-navy">
                            {reservation.montant
                              ? `${formatPrice(reservation.montant)} FCFA / nuit`
                              : 'Prix sur demande'}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-slate-500">
                    Les chambres que vous consultez apparaîtront ici.
                  </p>
                )}
              </section>
            </div>

            {/* ========== COLONNE DROITE ========== */}
            <aside className="space-y-5">
              {/* Profil */}
              <section className="card overflow-hidden">
                <div className="flex items-center gap-4 bg-gradient-to-r from-navy-900 to-navy p-4 text-white">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="h-[70px] w-[70px] rounded-full object-cover ring-4 ring-white/90"
                    />
                  ) : (
                    <span className="avatar h-[70px] w-[70px] text-xl ring-4 ring-white/90">
                      {initialsOf(fullName)}
                    </span>
                  )}
                  <div>
                    <p className="text-lg font-semibold">{fullName}</p>
                    <span className="mt-1 inline-block rounded border border-white/30 bg-white/10 px-2.5 py-0.5 text-[10px]">
                      Client
                    </span>
                    <p className="mt-2 text-xs">Ravi de vous revoir sur Linkhoo !</p>
                  </div>
                </div>
                <div className="p-4">
                  <Link to={profilePath} className="flex items-center justify-between text-sm font-semibold text-navy">
                    Mes informations<Icon id="right" className="h-4 w-4" />
                  </Link>
                  <dl className="mt-4 space-y-3 text-[11px]">
                    <div className="flex items-center gap-3">
                      <Icon id="mail" className="!h-4 !w-4 text-blue-700" />
                      <dt className="w-24 text-slate-500">Email</dt>
                      <dd className="min-w-0 truncate text-slate-700">{email || '—'}</dd>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon id="phone" className="!h-4 !w-4 text-blue-700" />
                      <dt className="w-24 text-slate-500">Téléphone</dt>
                      <dd className="text-slate-700">{phone || '—'}</dd>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon id="pin" className="!h-4 !w-4 text-blue-700" />
                      <dt className="w-24 text-slate-500">Ville</dt>
                      <dd className="text-slate-700">{cityLabel}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              {/* Premium */}
              <section className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                <Icon id="crown" className="f h-10 w-10 text-habi" />
                <div className="flex-1">
                  <p className="text-sm font-semibold leading-snug text-habi">
                    Réservation protégée
                  </p>
                  <p className="mt-3 text-[11px] leading-snug text-slate-600">
                    Accédez à des offres exclusives, des réductions et bien plus encore.
                  </p>
                  <div className="mt-3 rounded-lg bg-white/70 p-3 text-[11px] leading-snug text-slate-700">
                    En payant les frais de séjour via la plateforme, vous activez la
                    protection : en cas d’annulation, le remboursement est géré par la
                    plateforme.
                  </div>
                </div>
              </section>

              {/* Messages récents */}
              <section className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-3 text-sm font-semibold text-navy">
                    <Icon id="msg" className="text-blue-700" />Messages récents
                  </h2>
                  <Link to={messagesPath} className="link">
                    Voir tout<Icon id="arrow" className="!h-3.5 !w-3.5" />
                  </Link>
                </div>
                <ul className="divide-y divide-slate-100">
                  {unreadMessages > 0 && (
                    <li className="flex items-center gap-3 py-3">
                      <span className="avatar h-10 w-10 rounded-xl text-xs">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-navy">Nouveaux messages</p>
                        <p className="truncate text-[11px] text-slate-400">
                          Vous avez {unreadMessages} message{unreadMessages > 1 ? 's' : ''} non lu{unreadMessages > 1 ? 's' : ''}.
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] text-slate-400">Aujourd’hui</span>
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-habi text-[9px] font-semibold text-white">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      </div>
                    </li>
                  )}
                  {latestConversation && (
                    <li className="flex items-center gap-3 py-3">
                      <span className="avatar h-10 w-10 rounded-xl text-xs">
                        {initialsOf(latestConversation.client_name || 'C')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-navy">
                          {latestConversation.room?.title || 'Conversation'}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {latestConversation.last_message
                            ? `${latestConversation.last_message.sender_role === 'client' ? 'Vous : ' : ''}${latestConversation.last_message.body}`
                            : 'Aucun message'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] text-slate-400">
                          {formatShortDate(
                            (latestConversation.last_message_at || latestConversation.created_at || '').slice(0, 10),
                          )}
                        </span>
                      </div>
                    </li>
                  )}
                  {!unreadMessages && !latestConversation && (
                    <li className="py-3">
                      <p className="text-[11px] text-slate-400">Aucun message pour le moment.</p>
                    </li>
                  )}
                </ul>
              </section>

              {/* Favoris */}
              <section className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-3 text-sm font-semibold text-navy">
                    <Icon id="heart" className="text-blue-700" />Mes favoris
                  </h2>
                  <Link to={favoritesPath} className="link">
                    Voir tout<Icon id="arrow" className="!h-3.5 !w-3.5" />
                  </Link>
                </div>
                {favoriteRooms.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {favoriteRooms.map((favorite, index) => (
                      <Link to={`${homePath}/chambre/${favorite.id}`} className="card p-1.5" key={`favorite-${favorite.id}`}>
                        <div className={`relative h-[52px] rounded-md r${(index % 4) + 1}`}>
                          {favorite.img && (
                            <img
                              src={favorite.img}
                              alt={favorite.alt || favorite.title}
                              className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
                              loading="lazy"
                              onError={(event) => { event.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span className="heart">
                            <Icon id="heart" className="f !h-3.5 !w-3.5 text-white/90" />
                          </span>
                        </div>
                        <p className="mt-2 truncate text-[10px] font-semibold text-navy">{favorite.title}</p>
                        <p className="mt-1.5 text-[10px] font-bold text-navy">
                          {favorite.price ? priceWithCurrency(favorite.price, favorite.price_unit) : 'Prix sur demande'}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-[11px] text-slate-500">
                    Ajoutez des chambres à vos favoris pour les retrouver ici.
                  </p>
                )}
              </section>

              {/* Support */}
              <section className="flex gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700">
                  <Icon id="help" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-navy">Votre satisfaction est notre priorité</p>
                  <p className="mt-2 text-[11px] leading-snug text-slate-500">
                    Une question, une suggestion ? Notre équipe est là pour vous aider.
                  </p>
                  <Link
                    to="/contact"
                    className="btn-o mt-3 !inline-block !w-auto bg-white px-5"
                  >
                    Contacter le support
                  </Link>
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}
