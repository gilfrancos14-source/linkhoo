import { useSearchParams, Link } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import {
  fetchAvailableRooms,
  fetchRoomsPage,
  fetchVilles,
  fetchQuartiers,
  type Room,
} from '../data/rooms';
import { fetchCategoriesByMarket } from '../data/categories';
import { priceWithCurrency, roomMeta, roomSubtitle } from '../lib/roomDisplay';
import StayCard from '../components/StayCard';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 6;

/** Filtre client — n'utilisé qu'en mode dates (liste disponible non paginée). */
function matchesQuery(room: Room, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    room.title.toLowerCase().includes(q) ||
    room.subtitle.toLowerCase().includes(q) ||
    room.description.toLowerCase().includes(q) ||
    room.ville.toLowerCase().includes(q) ||
    room.quartier.toLowerCase().includes(q) ||
    room.category.toLowerCase().includes(q) ||
    room.info.toLowerCase().includes(q)
  );
}

export default function SearchResultsPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
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
  const [priceMax, setPriceMax] = useState(500_000);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Clé de fetch : en mode dates on ne re-télécharge que si le marché ou les
  // dates changent (les filtres locaux sont appliqués en mémoire) ; sans dates,
  // chaque filtre serveur ou page déclenche un nouvel appel.
  const fetchKey = hasDates
    ? `d|${market}|${dateArrivee}|${dateDepart}`
    : `s|${market}|${query}|${selectedVille}|${selectedQuartier}|${selectedCategory}|${priceMax}|${currentPage}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);

    if (hasDates) {
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
    } else {
      fetchRoomsPage({
        market,
        q: query || undefined,
        ville: selectedVille || undefined,
        quartier: selectedQuartier || undefined,
        category: selectedCategory || undefined,
        prixMax: priceMax < 500_000 ? priceMax : undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      })
        .then((page) => {
          if (!alive) return;
          setRooms(page.items);
          setTotal(page.total);
        })
        .catch(() => {
          if (!alive) return;
          setRooms([]);
          setTotal(0);
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });
    }

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
    if (!hasDates) return rooms;
    return rooms.filter((room) => {
      if (!matchesQuery(room, query)) return false;
      if (selectedVille && room.ville !== selectedVille) return false;
      if (selectedQuartier && room.quartier !== selectedQuartier) return false;
      if (selectedCategory && room.category !== selectedCategory) return false;
      if (room.priceNum > priceMax) return false;
      return true;
    });
  }, [hasDates, rooms, query, selectedVille, selectedQuartier, selectedCategory, priceMax]);

  // Sans dates : total vient du serveur ; avec dates : découpage local.
  const totalPages = hasDates
    ? Math.ceil(filteredRooms.length / ITEMS_PER_PAGE)
    : Math.ceil(total / ITEMS_PER_PAGE);
  const paginatedRooms = hasDates
    ? filteredRooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      )
    : filteredRooms;

  const resultCount = hasDates ? filteredRooms.length : total;
  const displayQuery = query.trim() || 'Tous les biens';

  if (loading) {
    return (
      <main className="search-page">
        <div className="container">
          <p className="search-page__empty-title">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="search-page">
      <div className="container">
        <nav className="search-page__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath}>Accueil</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Recherche</span>
        </nav>

        {needsDates ? (
          /* ===== PANNEAU DE SÉLECTION DE DATES ===== */
          <div className="search-page__dates-panel">
            <div className="search-page__dates-panel-inner">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--sky)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <h1 className="search-page__dates-title">
                {query ? <>Recherche pour <em>{query}</em></> : 'Sélectionnez vos dates'}
              </h1>
              <p className="search-page__dates-desc">
                Renseignez vos dates d'arrivée et de départ pour voir les biens disponibles.
              </p>

              <form className="search-page__dates-form" onSubmit={handleDatesSubmit} noValidate>
                <div className="search-page__dates-fields">
                  <div className="search-page__dates-field">
                    <label htmlFor="sp-arrivee">Arrivée <span aria-hidden="true">*</span></label>
                    <input
                      type="date"
                      id="sp-arrivee"
                      aria-required="true"
                      aria-invalid={!!panelError && !panelArrivee}
                      value={panelArrivee}
                      onChange={(e) => { setPanelArrivee(e.target.value); if (panelError) setPanelError(''); }}
                    />
                  </div>
                  <div className="search-page__dates-field">
                    <label htmlFor="sp-depart">Départ <span aria-hidden="true">*</span></label>
                    <input
                      type="date"
                      id="sp-depart"
                      aria-required="true"
                      aria-invalid={!!panelError && !panelDepart}
                      value={panelDepart}
                      onChange={(e) => { setPanelDepart(e.target.value); if (panelError) setPanelError(''); }}
                    />
                  </div>
                </div>
                {panelError && <p className="search-page__dates-error" role="alert">{panelError}</p>}
                <button type="submit" className="search-page__dates-btn">Voir les disponibilités</button>
              </form>
            </div>
          </div>
        ) : (
          /* ===== RÉSULTATS ===== */
          <>
            <div className="search-page__header">
              <div>
                <h1 className="search-page__title">
                  Résultats pour <em>{displayQuery}</em>
                </h1>
                <p className="search-page__count">
                  {resultCount} bien{resultCount !== 1 ? 's' : ''} trouvé{resultCount !== 1 ? 's' : ''}
                </p>
              </div>
              {dateArrivee && dateDepart && (
                <div className="search-page__dates-summary">
                  {dateArrivee} → {dateDepart}
                  <button type="button" className="search-page__dates-change" onClick={() => setSearchParams({ q: query })}>
                    Modifier
                  </button>
                </div>
              )}
            </div>

            <div className="search-page__layout">
              <aside className="search-page__filters">
                <h2 className="search-page__filter-title">Filtres</h2>
                <div className="search-page__filter-group">
                  <label htmlFor="sp-ville">Ville</label>
                  <select id="sp-ville" value={selectedVille} onChange={(e) => { setSelectedVille(e.target.value); setCurrentPage(1); }}>
                    <option value="">Toutes</option>
                    {villes.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="search-page__filter-group">
                  <label htmlFor="sp-quartier">Quartier</label>
                  <select id="sp-quartier" value={selectedQuartier} onChange={(e) => { setSelectedQuartier(e.target.value); setCurrentPage(1); }}>
                    <option value="">Tous</option>
                    {quartiers.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div className="search-page__filter-group">
                  <label htmlFor="sp-categorie">Catégorie</label>
                  <select id="sp-categorie" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}>
                    <option value="">Toutes</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div className="search-page__filter-group">
                  <label htmlFor="sp-prix">Prix max : {priceWithCurrency(priceMax)}</label>
                  <input
                    type="range"
                    id="sp-prix"
                    min={0}
                    max={500_000}
                    step={1000}
                    value={priceMax}
                    onChange={(e) => { setPriceMax(Number(e.target.value)); setCurrentPage(1); }}
                  />
                </div>
                {(selectedVille || selectedQuartier || selectedCategory || priceMax < 500_000) && (
                  <button
                    type="button"
                    className="search-page__filter-reset"
                    onClick={() => { setSelectedVille(''); setSelectedQuartier(''); setSelectedCategory(''); setPriceMax(500_000); setCurrentPage(1); }}
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </aside>

              <div className="search-page__results">
                {paginatedRooms.length === 0 ? (
                  <div className="search-page__empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <p className="search-page__empty-title">
                      {dateArrivee && dateDepart ? 'Aucune disponibilité pour ces dates' : 'Aucun résultat'}
                    </p>
                    <p className="search-page__empty-desc">
                      {dateArrivee && dateDepart
                        ? 'Essayez d\'autres dates ou modifiez vos critères de recherche.'
                        : 'Essayez de modifier vos critères de recherche ou réinitialisez les filtres.'}
                    </p>
                  </div>
                ) : (
                  <div className="search-page__grid">
                    {paginatedRooms.map((room) => (
                      <StayCard
                        key={room.id}
                        image={room.img}
                        alt={room.alt}
                        title={room.title}
                        rating={room.ville}
                        ratingType="loc"
                        description={roomSubtitle(room)}
                        price={room.price}
                        priceUnit={room.priceUnit}
                        href={`/${market.toLowerCase()}/chambre/${room.id}?arrivee=${encodeURIComponent(dateArrivee)}&depart=${encodeURIComponent(dateDepart)}`}
                        badge={
                          !room.disponible ? 'Indisponible' : room.gerantPremium ? 'Premium' : undefined
                        }
                        badgeVariant={
                          !room.disponible ? 'unavailable' : room.gerantPremium ? 'premium' : 'default'
                        }
                        meta={roomMeta(room)}
                      />
                    ))}
                  </div>
                )}

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className="search-page__pagination"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
