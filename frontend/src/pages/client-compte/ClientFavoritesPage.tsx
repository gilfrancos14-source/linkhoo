import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { marketByCode, type MarketCode } from '../../config/markets';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import { type FavoriteRoomData } from '../../lib/api';
import { priceWithCurrency } from '../../lib/roomDisplay';
import { useFavorites } from '../../contexts/FavoritesContext';
import ClientSidebar from '../../components/client/ClientSidebar';

/**
 * Page "Mes favoris" — une interface moderne et élégante pour gérer les chambres favorites.
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

export interface ClientFavoritesPageProps {
  displayName: string;
  email: string;
  profileFirstName: string;
  profileLastName: string;
  phone: string;
  avatarUrl?: string | null;
  favorites: FavoriteRoomData[];
  loading: boolean;
  error: string;
  homePath: string;
}

export default function ClientFavoritesPage({
  displayName,
  profileFirstName,
  profileLastName,
  avatarUrl,
  favorites,
  loading,
  error,
  homePath,
}: ClientFavoritesPageProps) {
  const marketContext = useMarket();
  if (!marketContext.market) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Une erreur est survenue</h2>
          <p className="text-gray-600 mb-4">Le marché n'est pas défini. Veuillez réessayer ultérieurement.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }
  const { market } = marketContext;
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { remove } = useFavorites();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [sortBy, setSortBy] = useState<'recent' | 'price-low' | 'price-high' | 'rating'>('recent');
  
  // Catégories
  const [categories, setCategories] = useState<Category[]>([]);
  const [heroDestination, setHeroDestination] = useState('');
  const [heroArrivee, setHeroArrivee] = useState('');
  const [heroDepart, setHeroDepart] = useState('');
  const [heroCategory, setHeroCategory] = useState('');
  const [heroError, setHeroError] = useState('');

  // Charger les catégories
  useEffect(() => {
    let alive = true;
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

  // Charger les conversations
  useEffect(() => {
    // Fonctionnalité désactivée temporairement
  }, []);

  // Chemins
  const profilePath = `${homePath}/compte?view=profile`;
  const searchPath = `${homePath}/recherche`;
  const marketLabel = marketByCode(market)?.label || 'Label non disponible';
  const cityLabel = `${MARKET_CAPITALS[market] || 'Ville'}, ${marketLabel}`;

  const fullName = [profileFirstName, profileLastName].filter(Boolean).join(' ') || displayName || 'Client';

  // Filtrer et trier les favoris
  const filteredFavorites = useMemo(() => {
    if (!Array.isArray(favorites)) {
      return [];
    }
    return favorites;
  }, [favorites]);

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
    if (typeof heroArrivee === 'string' && heroArrivee !== '' && typeof heroDepart === 'string' && heroDepart !== '' && heroDepart <= heroArrivee) {
      setHeroError('La date de départ doit être postérieure à la date d\'arrivée.');
      return;
    }
    if ((typeof heroArrivee === 'string' && heroArrivee === '') !== (typeof heroDepart === 'string' && heroDepart === '')) {
      setHeroError('Renseignez la date d\'arrivée et la date de départ.');
      return;
    }
    setHeroError('');

    const params = new URLSearchParams();
    const destination = typeof heroDestination === 'string' ? heroDestination.trim() : '';
    if (destination) params.set('q', destination);
    if (typeof heroArrivee === 'string' && heroArrivee) params.set('arrivee', heroArrivee);
    if (typeof heroDepart === 'string' && heroDepart) params.set('depart', heroDepart);
    if (typeof heroCategory === 'string' && heroCategory) params.set('categorie', heroCategory);
    const search = params.toString();
    navigate(`${searchPath}${search ? `?${search}` : ''}`);
  };

  return (
    <div className="cdash-maq font-sans flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800 antialiased leading-normal">
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
        <symbol id="cd-filter" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
        <symbol id="cd-view-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></symbol>
        <symbol id="cd-view-list" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="2" rx="1" /><rect x="4" y="10" width="16" height="2" rx="1" /><rect x="4" y="16" width="16" height="2" rx="1" /></symbol>
      </svg>

      {/* Utiliser la nouvelle sidebar unifiée */}
      <ClientSidebar />

      <div className="client-main flex min-h-screen">
        {/* Contenu principal */}
        <div className="min-w-0 flex-1">
          <header className="flex h-[60px] items-center gap-4 border-b border-slate-100 bg-white/70 px-4 sm:px-6">
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

          <main className="p-6">
            {/* Hero section */}
            <section className="favorites-hero relative mb-8 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative p-8 md:p-12">
                <div className="flex items-center gap-3 mb-4">
                  <Icon id="heart" className="f h-8 w-8 text-white" />
                  <h1 className="favorites-hero__title">Mes Chambres Favorites</h1>
                </div>
                <p className="favorites-hero__subtitle">
                  Découvrez à nouveau vos sélections préférées et trouvez votre prochain séjour parfait.
                </p>
                
                {/* Formulaire de recherche */}
                <form
                  onSubmit={handleHeroSearch}
                  noValidate
                  className="relative flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 pl-5 text-slate-800"
                >
                  <div className="flex min-w-[170px] flex-1 items-center gap-3 py-1">
                    <Icon id="pin" className="text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-destination"
                        className="block text-[11px] font-semibold text-purple-600"
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
                    <Icon id="cal" className="text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-arrivee"
                        className="block text-[11px] font-semibold text-purple-600"
                      >
                        Arrivée
                      </label>
                      <button
                        type="button"
                        id="cdash-arrivee"
                        className="block w-full truncate border-0 bg-transparent p-0 text-left text-[10px] leading-[15px] text-slate-700"
                      >
                        {typeof heroArrivee === 'string' && heroArrivee ? formatShortDate(heroArrivee) : 'Choisir une date'}
                      </button>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        tabIndex={-1}
                        aria-label="Date d'arrivée"
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
                    <Icon id="cal" className="text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-depart"
                        className="block text-[11px] font-semibold text-purple-600"
                      >
                        Départ
                      </label>
                      <button
                        type="button"
                        id="cdash-depart"
                        className="block w-full truncate border-0 bg-transparent p-0 text-left text-[10px] leading-[15px] text-slate-700"
                      >
                        {typeof heroDepart === 'string' && heroDepart ? formatShortDate(heroDepart) : 'Choisir une date'}
                      </button>
                      <input
                        type="date"
                        min={typeof heroArrivee === 'string' ? heroArrivee : new Date().toISOString().slice(0, 10)}
                        tabIndex={-1}
                        aria-label="Date de départ"
                        value={typeof heroDepart === 'string' ? heroDepart : ''}
                        onChange={(event) => {
                          setHeroDepart(event.target.value);
                          if (heroError) setHeroError('');
                        }}
                        className="sr-only"
                      />
                    </div>
                  </div>
                  <div className="flex min-w-[170px] flex-1 items-center gap-3 border-slate-200 py-1 md:border-l md:pl-4">
                    <Icon id="bed" className="text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="cdash-category"
                        className="block text-[11px] font-semibold text-purple-600"
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
                        {Array.isArray(categories) && categories.map((category) => (
                          <option key={typeof category.id === 'string' ? category.id : 'unknown'} value={typeof category.id === 'string' ? category.id : ''}>
                            {typeof category.title === 'string' ? category.title : 'Titre non disponible'}
                          </option>
                        ))}
                      </select>
                      <Icon id="down" className="mr-2 h-4 w-4" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="flex h-11 items-center justify-center gap-2 rounded-lg bg-purple-600 px-9 text-xs font-semibold text-white hover:bg-purple-700"
                  >
                    <Icon id="search" className="h-4 w-4" />Rechercher
                  </button>
                  {heroError && (
                    <p role="alert" className="basis-full pl-1 pt-1 text-[11px] font-medium text-red-600">
                      {heroError}
                    </p>
                  )}
                </form>
              </div>
            </section>

            {/* Stats et filtres */}
            <div className="mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Vos Favoris</h2>
                  <p className="text-slate-600 mt-1">
                    {filteredFavorites.length} chambre{filteredFavorites.length > 1 ? 's' : ''} sauvegardée{filteredFavorites.length > 1 ? 's' : ''}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Mode d'affichage */}
                  <div className="flex rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      className={`px-3 py-2 rounded-l-lg ${viewMode === 'grid' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      onClick={() => setViewMode('grid')}
                    >
                      <Icon id="view-grid" className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 rounded-r-lg ${viewMode === 'list' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      onClick={() => setViewMode('list')}
                    >
                      <Icon id="view-list" className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Tri */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (['recent', 'price-low', 'price-high', 'rating'].includes(value)) {
                        setSortBy(value as 'recent' | 'price-low' | 'price-high' | 'rating');
                      }
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="recent">Plus récentes</option>
                    <option value="price-low">Prix croissant</option>
                    <option value="price-high">Prix décroissant</option>
                    <option value="rating">Meilleures notes</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Liste des favoris */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-red-600">{error}</p>
              </div>
            ) : filteredFavorites.length > 0 ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {filteredFavorites.map((favorite, index) => (
                  <article key={`favorite-${typeof favorite.id === 'string' ? favorite.id : index}`} className={`card overflow-hidden rounded-xl border border-slate-200 bg-white hover:shadow-lg transition-shadow duration-300 ${viewMode === 'list' ? 'flex' : ''}`}>
                    <div className={viewMode === 'grid' ? 'relative h-[200px]' : 'relative h-[200px] flex-shrink-0'}>
                      {favorite.img && typeof favorite.img === 'string' && (
                        <img
                          src={favorite.img}
                          alt={favorite.alt || favorite.title || 'Image'}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          aria-label={
                            typeof favorite.title === 'string'
                              ? `Retirer ${favorite.title} des favoris`
                              : 'Retirer des favoris'
                          }
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur hover:bg-white"
                          onClick={() => {
                            if (typeof favorite.id === 'string') {
                              void remove(favorite.id).catch(() => {});
                            }
                          }}
                        >
                          <Icon id="heart" className="f !h-4 !w-4 text-red-500" />
                        </button>
                      </div>

                    </div>
                    
                    <div className={viewMode === 'grid' ? 'p-5' : 'p-5 flex-1'}>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-slate-800 line-clamp-1">{typeof favorite.title === 'string' ? favorite.title : 'Titre non disponible'}</h3>
                        {typeof favorite.price === 'number' && favorite.price && (
                          <p className="text-lg font-bold text-purple-600">
                            {priceWithCurrency(favorite.price, typeof favorite.price_unit === 'string' ? favorite.price_unit : 'FCFA')}
                          </p>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-600 mb-3">{typeof favorite.description === 'string' ? favorite.description : 'Description non disponible'}</p>
                      
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                        <Icon id="pin" className="!h-4 !w-4 text-purple-600" />
                        <span>{typeof favorite.quartier === 'string' ? favorite.quartier : cityLabel}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          {typeof favorite.category === 'string' ? favorite.category : 'Catégorie'}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Link
                          to={`${homePath}/chambre/${typeof favorite.id === 'string' ? favorite.id : ''}`}
                          className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
                        >
                          Voir la chambre
                        </Link>
                        <button
                          type="button"
                          className="rounded-lg border border-purple-600 px-4 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          Réserver
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                  <Icon id="heart" className="f !h-12 !w-12 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Aucune chambre favorite</h3>
                <p className="text-slate-600 mb-6">
                  Parcourez notre sélection et ajoutez les chambres que vous aimez à vos favoris.
                </p>
                <Link
                  to={searchPath}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
                >
                  Explorer les chambres<Icon id="arrow" className="!h-4 !w-4" />
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Fonction utilitaire pour les initiales
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'C';
}

