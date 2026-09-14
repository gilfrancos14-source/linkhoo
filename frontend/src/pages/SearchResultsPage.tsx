import { useSearchParams, Link } from 'react-router-dom';
import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { fetchRoomsByMarket, getVillesFromRooms, getQuartiersFromRooms, type Room } from '../data/rooms';
import { fetchCategoriesByMarket } from '../data/categories';
import StayCard from '../components/StayCard';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 6;

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
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRoomsByMarket(market),
      fetchCategoriesByMarket(market),
    ]).then(([r, c]) => {
      setRooms(r);
      setCategories(c);
      setLoading(false);
    });
  }, [market]);

  const villes = useMemo(() => getVillesFromRooms(rooms), [rooms]);
  const quartiers = useMemo(() => getQuartiersFromRooms(rooms), [rooms]);

  const query = searchParams.get('q') ?? '';
  const dateArrivee = searchParams.get('arrivee') ?? '';
  const dateDepart = searchParams.get('depart') ?? '';

  // Dates manquantes → on affiche le panneau de sélection
  const needsDates = !dateArrivee || !dateDepart;

  // Filtres
  const [selectedVille, setSelectedVille] = useState('');
  const [selectedQuartier, setSelectedQuartier] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [currentPage, setCurrentPage] = useState(1);

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
    setSearchParams({ q: query, arrivee: panelArrivee, depart: panelDepart });
  };

  // Filtrage
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (!matchesQuery(room, query)) return false;
      if (selectedVille && room.ville !== selectedVille) return false;
      if (selectedQuartier && room.quartier !== selectedQuartier) return false;
      if (selectedCategory && room.category !== selectedCategory) return false;
      const price = parseInt(room.price.replace(/\s/g, ''), 10);
      if (price < priceRange[0] || price > priceRange[1]) return false;
      return true;
    });
  }, [rooms, query, selectedVille, selectedQuartier, selectedCategory, priceRange]);

  const totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);
  const paginatedRooms = filteredRooms.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
                  {filteredRooms.length} bien{filteredRooms.length !== 1 ? 's' : ''} trouvé{filteredRooms.length !== 1 ? 's' : ''}
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
                  <label htmlFor="sp-prix">Prix max : {priceRange[1]} FCFA</label>
                  <input
                    type="range"
                    id="sp-prix"
                    min={0}
                    max={500}
                    step={10}
                    value={priceRange[1]}
                    onChange={(e) => { setPriceRange([0, Number(e.target.value)]); setCurrentPage(1); }}
                  />
                </div>
                {(selectedVille || selectedQuartier || selectedCategory || priceRange[1] < 500) && (
                  <button
                    type="button"
                    className="search-page__filter-reset"
                    onClick={() => { setSelectedVille(''); setSelectedQuartier(''); setSelectedCategory(''); setPriceRange([0, 500]); setCurrentPage(1); }}
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
                    <p className="search-page__empty-title">Aucun résultat</p>
                    <p className="search-page__empty-desc">
                      Essayez de modifier vos critères de recherche ou réinitialisez les filtres.
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
                        description={room.subtitle}
                        price={room.price}
                        priceUnit={room.priceUnit}
                        href={`/${market.toLowerCase()}/chambre/${room.id}`}
                        badge={room.disponible ? undefined : 'Indisponible'}
                        badgeVariant={room.disponible ? 'default' : 'unavailable'}
                        meta={[room.capacity, `${room.chambres} chambre${room.chambres > 1 ? 's' : ''}`]}
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
