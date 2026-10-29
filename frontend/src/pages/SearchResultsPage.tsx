import { useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import '../styles/17-search-results.css';
import {
  fetchAvailableRooms,
  fetchVilles,
  fetchQuartiers,
  type Room,
} from '../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../data/categories';
import { priceWithCurrency } from '../lib/roomDisplay';
import { sortRoomsByTier } from '../lib/roomRanking';
import SearchStayCard from '../components/SearchStayCard';
import PremiumRoomsCarousel from '../components/PremiumRoomsCarousel';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeader from '../components/landing/LandingHeader';
import { COUNTRIES, DEFAULT_COUNTRY } from '../components/landing/data';
import Icon from '../components/landing/icons';

const ITEMS_PER_PAGE = 6;
const PRICE_CEILING = 500_000;
/** Nombre maximal de chambres mises en avant dans le carrousel premium. */
const PREMIUM_SHOWCASE_LIMIT = 9;

type SortKey = 'recommended' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Recommandés' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Filtre client — n'agit que sur les critères réellement présents dans le bien. */
function matchesQuery(room: Room, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  return normalize(
    [
      room.title,
      room.subtitle,
      room.description,
      room.ville,
      room.quartier,
      room.category,
      room.info,
      room.conditions,
    ].join(' '),
  ).includes(q);
}

/** Pastilles factuelles : chambres, salles d'eau, condition d'annulation. */
function searchMeta(room: Room): string[] {
  const meta: string[] = [];
  if (room.chambres > 0) meta.push(`${room.chambres} ch.`);
  if (room.douches > 0) meta.push(`${room.douches} sdb`);
  if (room.conditions) meta.push(room.conditions);
  return meta.slice(0, 3);
}

function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function SlidersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </svg>
  );
}

function EditIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Underline() {
  return (
    <svg
      className="search-page__title-underline"
      viewBox="0 0 240 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 9.5C65.5 3.5 178.5 2.5 237.5 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * Fenêtre glissante de pages : garde la pagination lisible sur mobile même
 * quand le catalogue compte beaucoup de pages.
 */
function paginationItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(2, Math.min(currentPage - 1, totalPages - 4));
  const end = Math.min(totalPages - 1, Math.max(currentPage + 1, 5));
  const items: PageItem[] = [1];

  if (start > 2) items.push('ellipsis-start');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push('ellipsis-end');

  items.push(totalPages);
  return items;
}

function SearchPagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="search-page__pagination" aria-label="Pagination">
      <button
        type="button"
        className="search-page__page-btn search-page__page-btn--nav"
        aria-label="Page précédente"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <Icon name="chevronLeft" size={18} />
      </button>
      {paginationItems(currentPage, totalPages).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            className={`search-page__page-btn${item === currentPage ? ' is-active' : ''}`}
            aria-current={item === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="search-page__page-ellipsis" aria-hidden="true">
            …
          </span>
        ),
      )}
      <button
        type="button"
        className="search-page__page-btn search-page__page-btn--nav"
        aria-label="Page suivante"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <Icon name="chevronRight" size={18} />
      </button>
    </nav>
  );
}

function SearchHeader({ onSearchClick }: { onSearchClick: () => void }) {
  const { market } = useMarket();
  const navigate = useNavigate();
  const country = COUNTRIES.find((item) => item.code === market) ?? DEFAULT_COUNTRY;

  return (
    <div className="search-header-scope">
      <LandingHeader
        country={country}
        onCountryClick={() => navigate('/')}
        onSearchClick={onSearchClick}
      />
    </div>
  );
}

function SearchFooter() {
  return (
    <div className="search-footer-scope">
      <LandingFooter />
    </div>
  );
}

export default function SearchResultsPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [villes, setVilles] = useState<string[]>([]);
  const [quartiers, setQuartiers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const query = searchParams.get('q') ?? '';
  const dateArrivee = searchParams.get('arrivee') ?? '';
  const dateDepart = searchParams.get('depart') ?? '';
  const categorieParam = searchParams.get('categorie') ?? '';

  // Filtres
  const [selectedVille, setSelectedVille] = useState('');
  const [selectedQuartier, setSelectedQuartier] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categorieParam);
  const [priceMax, setPriceMax] = useState(PRICE_CEILING);
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('recommended');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Référentiels : catégories, villes, quartiers (endpoints dédiés,
  // pas besoin de tout le catalogue).
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchCategoriesByMarket(market),
      fetchVilles(market),
      fetchQuartiers(market),
    ])
      .then(([c, v, q]) => {
        if (!alive) return;
        setCategories(c);
        setVilles(v);
        setQuartiers(q);
      })
      .catch(() => {
        if (!alive) return;
        setCategories([]);
        setVilles([]);
        setQuartiers([]);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  // Dates manquantes → on affiche le panneau de sélection
  const needsDates = !dateArrivee || !dateDepart;
  const hasDates = !needsDates;

  // Changement de dates (ou bascule dates ↔ pas-de-dates) : revient à la
  // première page pour éviter une page vide si le nouveau séjour a moins
  // de résultats que la page courante.
  const datesKey = `${dateArrivee}|${dateDepart}`;
  const prevDatesKeyRef = useRef(datesKey);
  useEffect(() => {
    if (prevDatesKeyRef.current !== datesKey) {
      prevDatesKeyRef.current = datesKey;
      setCurrentPage(1);
    }
  }, [datesKey]);

  // Clé de fetch : on ne re-télécharge que si le marché ou les dates changent.
  // Les filtres (ville, quartier, catégorie, prix) et la pagination sont
  // appliqués en mémoire sur le sous-ensemble disponible.
  const fetchKey = `d|${market}|${dateArrivee}|${dateDepart}`;

  useEffect(() => {
    // Sans dates, la page n'affiche que le panneau de sélection : télécharger
    // le catalogue ne servirait à rien, aucun résultat ne peut être rendu.
    if (!hasDates) {
      setRooms([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    fetchAvailableRooms(market, dateArrivee, dateDepart)
      .then((data) => {
        if (!alive) return;
        setRooms(data);
        setTotal(data.length);
      })
      .catch(() => {
        if (!alive) return;
        setRooms([]);
        setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchKey regroupe les deps
  }, [fetchKey]);

  // Panneau de dates
  const [panelArrivee, setPanelArrivee] = useState('');
  const [panelDepart, setPanelDepart] = useState('');
  const [panelError, setPanelError] = useState('');

  const handleDatesSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!panelArrivee || !panelDepart) {
      setPanelError('Veuillez renseigner les deux dates.');
      return;
    }
    if (panelDepart <= panelArrivee) {
      setPanelError('La date de départ doit être ultérieure à la date d\'arrivée.');
      return;
    }
    setPanelError('');
    setSearchParams({
      q: query,
      arrivee: panelArrivee,
      depart: panelDepart,
      ...(categorieParam ? { categorie: categorieParam } : {}),
    });
  };

  // Mode dates : filtre client sur la liste disponible (sous-ensemble).
  const filteredRooms = useMemo(() => {
    if (!hasDates) {
      return rooms.filter(
        (room) =>
          matchesQuery(room, query) &&
          (!selectedVille || room.ville === selectedVille) &&
          (!selectedQuartier || room.quartier === selectedQuartier) &&
          (!selectedCategory || room.category === selectedCategory) &&
          room.priceNum <= priceMax,
      );
    }
    return rooms.filter((room) => {
      if (!matchesQuery(room, query)) return false;
      if (selectedVille && room.ville !== selectedVille) return false;
      if (selectedQuartier && room.quartier !== selectedQuartier) return false;
      if (selectedCategory && room.category !== selectedCategory) return false;
      if (room.priceNum > priceMax) return false;
      return true;
    });
  }, [hasDates, rooms, query, selectedVille, selectedQuartier, selectedCategory, priceMax]);

  // Classement de la recherche : gérants premium, puis vérifiés, puis non
  // vérifiés. L'ordre organique du serveur est conservé dans chaque palier.
  const rankedRooms = useMemo(() => sortRoomsByTier(filteredRooms), [filteredRooms]);

  // Sélection premium : uniquement le marché courant (dates de disponibilité
  // incluses), indépendamment des filtres ville / catégorie / budget / q.
  // Une chambre par gérant en priorité, puis les autres chambres premium.
  const premiumRooms = useMemo(() => {
    const premium = rooms.filter((room) => room.gerantPremium);
    const firstByGerant = new Map<string, Room>();
    const rest: Room[] = [];

    for (const room of premium) {
      const key = room.gerantId ?? room.id;
      if (!firstByGerant.has(key)) firstByGerant.set(key, room);
      else rest.push(room);
    }

    return [...firstByGerant.values(), ...rest].slice(0, PREMIUM_SHOWCASE_LIMIT);
  }, [rooms]);

  // Sans dates : total vient du serveur ; avec dates : découpage local.
  const totalPages = hasDates
    ? Math.ceil(rankedRooms.length / ITEMS_PER_PAGE)
    : Math.ceil(total / ITEMS_PER_PAGE);
  const paginatedRooms = hasDates
    ? rankedRooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE,
      )
    : rankedRooms;

  const sortedRooms = useMemo(() => {
    if (sortBy === 'recommended') return paginatedRooms;
    return [...paginatedRooms].sort((a, b) =>
      sortBy === 'price-asc' ? a.priceNum - b.priceNum : b.priceNum - a.priceNum,
    );
  }, [paginatedRooms, sortBy]);

  const resultCount = hasDates ? filteredRooms.length : total;
  const displayQuery = query.trim() || 'Tous les biens';
  const destinationLabel = selectedVille || query.trim() || villes[0] || 'votre séjour';
  const activeFilterCount = [
    selectedVille,
    selectedQuartier,
    selectedCategory,
    priceMax < PRICE_CEILING ? 'price' : '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedVille('');
    setSelectedQuartier('');
    setSelectedCategory('');
    setPriceMax(PRICE_CEILING);
    setCurrentPage(1);
  };

  const selectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const roomHref = (room: Room) =>
    `/${market.toLowerCase()}/chambre/${room.id}?arrivee=${encodeURIComponent(
      dateArrivee,
    )}&depart=${encodeURIComponent(dateDepart)}`;

  // Sur mobile les filtres sont repliés : le bouton « Rechercher » de
  // l'en-tête doit les ouvrir avant de donner le focus au champ ville.
  const focusSearch = () => {
    if (hasDates) setFiltersOpen(true);
    window.requestAnimationFrame(() => {
      const input = document.getElementById(hasDates ? 'sp-ville' : 'sp-arrivee');
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input?.focus({ preventScroll: true });
    });
  };

  if (loading) {
    return (
      <>
        <SearchHeader onSearchClick={focusSearch} />
        <main className="search-page">
          <div className="search-page__shell search-page__loading">
            <p className="search-page__loading-text">Chargement...</p>
            <div className="search-page__loading-hero" aria-hidden="true">
              <span className="search-page__loading-line search-page__loading-line--sm" />
              <span className="search-page__loading-line search-page__loading-line--lg" />
              <span className="search-page__loading-line search-page__loading-line--md" />
            </div>
            <div className="search-page__loading-grid" aria-hidden="true">
              {[0, 1, 2, 3].map((item) => (
                <div className="search-page__loading-card" key={item}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          </div>
        </main>
        <SearchFooter />
      </>
    );
  }

  return (
    <>
    <SearchHeader onSearchClick={focusSearch} />
    <main className="search-page">
      <section className="search-page__shell search-page__breadcrumb-section">
        <nav className="search-page__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath} className="search-page__breadcrumb-home">
            <Icon name="house" size={16} />
            Accueil
          </Link>
          <span aria-hidden="true">/</span>
          <span className="search-page__breadcrumb-muted">Recherche</span>
          <span aria-hidden="true">/</span>
          <span className="search-page__breadcrumb-current">
            {selectedVille || query.trim() || 'Toutes les villes'}
          </span>
        </nav>
      </section>

      <section className="search-page__masthead">
        <span className="search-page__glow search-page__glow--lilac" aria-hidden="true" />
        <span className="search-page__glow search-page__glow--sand" aria-hidden="true" />
        <div className="search-page__shell search-page__hero">
          <div className="search-page__intro">
            <p className="search-page__eyebrow">
              <span aria-hidden="true" />
              Votre prochain séjour
            </p>

            {needsDates ? (
              <>
                <h1 className="search-page__title">
                  {query ? (
                    <>
                      Recherche pour{' '}
                      <span className="search-page__title-accent">
                        {query}
                        <Underline />
                      </span>
                    </>
                  ) : (
                    'Sélectionnez vos dates'
                  )}
                </h1>
                <p className="search-page__lead">
                  Renseignez vos dates d&apos;arrivée et de départ pour voir les biens
                  disponibles. Les disponibilités sont vérifiées en temps réel.
                </p>
                <p className="search-page__count-line">
                  Choisissez vos dates · Tarifs en Francs CFA (XOF)
                </p>
              </>
            ) : (
              <>
                <h1 className="search-page__title">
                  Résultats pour{' '}
                  <span className="search-page__title-accent">
                    {displayQuery}
                    <Underline />
                  </span>
                </h1>
                <p className="search-page__count-line">
                  <span className="search-page__count">
                    {resultCount} bien{resultCount !== 1 ? 's' : ''} trouvé
                    {resultCount !== 1 ? 's' : ''}
                  </span>{' '}
                  · Tarifs en Francs CFA (XOF)
                </p>
              </>
            )}

            <div className="search-page__benefits">
              <span className="search-page__benefit">
                <Icon name="shieldCheck" size={16} />
                Annulation flexible
              </span>
              <span className="search-page__benefit">
                <Icon name="badgeCheck" size={16} />
                Hôtes vérifiés
              </span>
              <span className="search-page__benefit">
                <Icon name="shieldCheck" size={16} />
                Paiement sécurisé
              </span>
            </div>
          </div>

          {needsDates ? (
            <div className="search-page__summary-card search-page__dates-card">
              <div className="search-page__summary-head">
                <div className="search-page__summary-heading">
                  <span className="search-page__summary-dot" aria-hidden="true" />
                  <p>Votre séjour</p>
                </div>
              </div>

              <form className="search-page__dates-form" onSubmit={handleDatesSubmit} noValidate>
                <div className="search-page__dates-fields">
                  <div className="search-page__dates-field">
                    <label htmlFor="sp-arrivee">
                      Arrivée <span aria-hidden="true">*</span>
                    </label>
                    <input
                      type="date"
                      id="sp-arrivee"
                      aria-required="true"
                      aria-invalid={!!panelError && !panelArrivee}
                      value={panelArrivee}
                      onChange={(e) => {
                        setPanelArrivee(e.target.value);
                        if (panelError) setPanelError('');
                      }}
                    />
                  </div>
                  <div className="search-page__dates-field">
                    <label htmlFor="sp-depart">
                      Départ <span aria-hidden="true">*</span>
                    </label>
                    <input
                      type="date"
                      id="sp-depart"
                      aria-required="true"
                      aria-invalid={!!panelError && !panelDepart}
                      value={panelDepart}
                      onChange={(e) => {
                        setPanelDepart(e.target.value);
                        if (panelError) setPanelError('');
                      }}
                    />
                  </div>
                </div>
                {panelError && (
                  <p className="search-page__dates-error" role="alert">
                    {panelError}
                  </p>
                )}
                <button type="submit" className="search-page__dates-btn">
                  Voir les disponibilités
                  <Icon name="arrowRight" size={17} />
                </button>
              </form>

              <p className="search-page__dates-foot">
                <Icon name="shieldCheck" size={14} />
                Aucun frais caché · Réservation confirmée par l&apos;hôte
              </p>
            </div>
          ) : (
            <div className="search-page__summary-card" aria-label="Récapitulatif de la recherche">
              <div className="search-page__summary-head">
                <div className="search-page__summary-heading">
                  <span className="search-page__summary-dot" aria-hidden="true" />
                  <p>Votre recherche</p>
                </div>
                <button
                  type="button"
                  className="search-page__summary-edit"
                  onClick={() => setSearchParams({ q: query })}
                >
                  <EditIcon size={14} />
                  Modifier
                </button>
              </div>

              <div className="search-page__summary-grid">
                <div className="search-page__summary-item">
                  <span className="search-page__summary-label">Destination</span>
                  <div className="search-page__summary-value">
                    <Icon name="mapPin" size={18} />
                    <span>{destinationLabel}</span>
                  </div>
                </div>

                <div className="search-page__summary-item">
                  <span className="search-page__summary-label">Séjour</span>
                  <div className="search-page__summary-value search-page__summary-value--dates">
                    <CalendarIcon size={18} />
                    <span>
                      {dateArrivee} → {dateDepart}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </section>

      {!needsDates && (
        <>
          {premiumRooms.length > 0 && (
            <div className="search-page__shell search-page__featured-shell">
              <PremiumRoomsCarousel
                rooms={premiumRooms}
                hrefFor={roomHref}
                metaFor={searchMeta}
              />
            </div>
          )}

          <section className="search-page__shell search-page__toolbar-section">
            <div className="search-page__toolbar">
              <div className="search-page__toolbar-left">
                <button
                  type="button"
                  className="search-page__filters-toggle"
                  aria-expanded={filtersOpen}
                  aria-controls="search-filters"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <SlidersIcon size={18} />
                  <span>Filtres</span>
                  {activeFilterCount > 0 && (
                    <span className="search-page__filters-count">{activeFilterCount}</span>
                  )}
                </button>

                <span className="search-page__toolbar-divider" aria-hidden="true" />

                <div
                  className="search-page__quickfilters"
                  role="group"
                  aria-label="Filtrer par catégorie"
                >
                  <button
                    type="button"
                    className={`search-page__pill${!selectedCategory ? ' is-active' : ''}`}
                    aria-pressed={!selectedCategory}
                    onClick={() => selectCategory('')}
                  >
                    Tous
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`search-page__pill${
                        selectedCategory === category.id ? ' is-active' : ''
                      }`}
                      aria-pressed={selectedCategory === category.id}
                      onClick={() => selectCategory(category.id)}
                    >
                      {category.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="search-page__toolbar-right">
                <div className="search-page__sort-group">
                  <span>Trier par :</span>
                  <label className="search-page__sort">
                    <select
                      aria-label="Trier par"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as SortKey)}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevronDown" size={16} />
                  </label>
                </div>

                <div className="search-page__view" role="group" aria-label="Affichage des résultats">
                  <button
                    type="button"
                    className={viewMode === 'grid' ? 'is-active' : ''}
                    aria-label="Vue grille"
                    aria-pressed={viewMode === 'grid'}
                    onClick={() => setViewMode('grid')}
                  >
                    <Icon name="layoutGrid" size={18} />
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'list' ? 'is-active' : ''}
                    aria-label="Vue liste"
                    aria-pressed={viewMode === 'list'}
                    onClick={() => setViewMode('list')}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="search-page__shell search-page__layout">
            <aside
              className={`search-page__filters${filtersOpen ? ' is-open' : ''}`}
              id="search-filters"
              aria-labelledby="search-filters-title"
            >
              <div className="search-page__filters-head">
                <div>
                  <span className="search-page__filters-eyebrow">Affiner</span>
                  <h2 id="search-filters-title">Filtres</h2>
                </div>
                <button
                  type="button"
                  className="search-page__filters-reset"
                  aria-label={activeFilterCount > 0 ? 'Réinitialiser les filtres' : undefined}
                  disabled={activeFilterCount === 0}
                  onClick={resetFilters}
                >
                  Réinitialiser
                </button>
              </div>

              <div className="search-page__filter-section">
                <label htmlFor="sp-ville">Ville</label>
                <div className="search-page__select-wrap">
                  <select
                    id="sp-ville"
                    value={selectedVille}
                    onChange={(e) => {
                      setSelectedVille(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">Toutes</option>
                    {villes.map((ville) => (
                      <option key={ville} value={ville}>
                        {ville}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={18} />
                </div>
              </div>

              <div className="search-page__filter-section">
                <label htmlFor="sp-quartier">Quartier</label>
                <div className="search-page__select-wrap">
                  <select
                    id="sp-quartier"
                    value={selectedQuartier}
                    onChange={(e) => {
                      setSelectedQuartier(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">Tous</option>
                    {quartiers.map((quartier) => (
                      <option key={quartier} value={quartier}>
                        {quartier}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={18} />
                </div>
              </div>

              <div className="search-page__filter-section">
                <label htmlFor="sp-categorie">Catégorie</label>
                <div className="search-page__select-wrap">
                  <select
                    id="sp-categorie"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">Toutes</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={18} />
                </div>
              </div>

              <div className="search-page__filter-section search-page__filter-section--price">
                <div className="search-page__price-head">
                  <label htmlFor="sp-prix">Budget par nuit</label>
                  <output htmlFor="sp-prix">{priceWithCurrency(priceMax)}</output>
                </div>
                <input
                  type="range"
                  id="sp-prix"
                  aria-label="Prix max"
                  min={0}
                  max={PRICE_CEILING}
                  step={1000}
                  value={priceMax}
                  onChange={(e) => {
                    setPriceMax(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                />
                <div className="search-page__price-scale" aria-hidden="true">
                  <span>0 FCFA</span>
                  <span>500 000 FCFA</span>
                </div>
              </div>

              <div className="search-page__filters-actions">
                <button
                  type="button"
                  className="search-page__apply"
                  onClick={() => setFiltersOpen(false)}
                >
                  Appliquer les filtres
                </button>
              </div>
            </aside>

            <section className="search-page__results">
              <div className="search-page__results-head">
                <p>
                  {rankedRooms.length} bien{rankedRooms.length !== 1 ? 's' : ''} d&apos;exception à{' '}
                  {destinationLabel}
                </p>
                <span>
                  Page {Math.min(currentPage, Math.max(totalPages, 1))} sur{' '}
                  {Math.max(totalPages, 1)}
                </span>
              </div>

              <p className="search-page__results-note">
                <Icon name="badgeCheck" size={14} />
                Hôtes premium en tête, puis hôtes vérifiés.
              </p>

              {sortedRooms.length === 0 ? (
                <div className="search-page__empty">
                  <span className="search-page__empty-icon" aria-hidden="true">
                    <Icon name="search" size={32} />
                  </span>
                  <p className="search-page__empty-title">
                    {dateArrivee && dateDepart
                      ? 'Aucune disponibilité pour ces dates'
                      : 'Aucun résultat'}
                  </p>
                  <p className="search-page__empty-desc">
                    {dateArrivee && dateDepart
                      ? "Essayez d'autres dates ou modifiez vos critères de recherche."
                      : 'Essayez de modifier vos critères de recherche ou réinitialisez les filtres.'}
                  </p>
                  {activeFilterCount > 0 ? (
                    <button type="button" className="search-page__empty-btn" onClick={resetFilters}>
                      Effacer les filtres
                    </button>
                  ) : (
                    dateArrivee &&
                    dateDepart && (
                      <button
                        type="button"
                        className="search-page__empty-btn"
                        onClick={() => setSearchParams({ q: query })}
                      >
                        Modifier les dates
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div
                  className={`search-page__grid${
                    viewMode === 'list' ? ' search-page__grid--list' : ''
                  }`}
                >
                  {sortedRooms.map((room) => (
                    <SearchStayCard
                      key={room.id}
                      room={room}
                      href={roomHref(room)}
                      meta={searchMeta(room)}
                    />
                  ))}
                </div>
              )}

              <SearchPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />

            </section>
          </div>
        </>
      )}
    </main>
    <SearchFooter />
    </>
  );
}
