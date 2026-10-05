import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { fetchRoomsPage, fetchVilles, fetchQuartiers, type Room } from '../data/rooms';
import { fetchCategoriesByMarket } from '../data/categories';
import { roomMeta, roomSubtitle } from '../lib/roomDisplay';
import StayCard from '../components/StayCard';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 6;

export default function CategoryPage() {
  const { market } = useMarket();
  const { id } = useParams<{ id: string }>();
  const homePath = useHomePath();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [villes, setVilles] = useState<string[]>([]);
  const [quartiers, setQuartiers] = useState<string[]>([]);
  const [optionsReady, setOptionsReady] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const category = categories.find((c: any) => c.id === id);

  const [ville, setVille] = useState('');
  const [quartier, setQuartier] = useState('');
  const [chambres, setChambres] = useState<number | ''>('');
  const [dateDispo, setDateDispo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // L'écran de chargement n'apparaît qu'au premier chargement (ou au
  // changement de catégorie/marché) : un changement de filtre met simplement
  // à jour les résultats en place, sans clignoter.
  const loading = pageLoading || !optionsReady || !resultsReady;

  // Référentiels : catégorie, villes et quartiers du marché (indépendants
  // des filtres de la page).
  useEffect(() => {
    let cancelled = false;
    setOptionsReady(false);
    Promise.all([
      fetchCategoriesByMarket(market),
      fetchVilles(market),
      fetchQuartiers(market),
    ])
      .then(([loadedCategories, loadedVilles, loadedQuartiers]) => {
        if (cancelled) return;
        setCategories(loadedCategories);
        setVilles(loadedVilles);
        setQuartiers(loadedQuartiers);
        setOptionsReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCategories([]);
        setVilles([]);
        setQuartiers([]);
        setOptionsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  // Nouvelle catégorie : on repart d'une page et de filtres vierges.
  useEffect(() => {
    setVille('');
    setQuartier('');
    setChambres('');
    setDateDispo('');
    setCurrentPage(1);
    setPageLoading(true);
  }, [id, market]);

  // Résultats : filtrés et paginés côté serveur, refetch à chaque filtre.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchRoomsPage({
      market,
      category: id,
      ville: ville || undefined,
      quartier: quartier || undefined,
      chambres: chambres === '' ? undefined : chambres,
      disponible: dateDispo === 'yes' ? true : undefined,
      page: currentPage,
      limit: ITEMS_PER_PAGE,
    })
      .then((page) => {
        if (cancelled) return;
        setRooms(page.items);
        setTotal(page.total);
        setResultsReady(true);
        setPageLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRooms([]);
        setTotal(0);
        setResultsReady(true);
        setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, id, ville, quartier, chambres, dateDispo, currentPage]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const resetFilters = () => {
    setVille('');
    setQuartier('');
    setChambres('');
    setDateDispo('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <main className="cat-page">
        <div className="container">
          <p className="cat-page__empty">Chargement...</p>
        </div>
      </main>
    );
  }

  if (!category) {
    return (
      <main className="cat-page">
        <div className="container">
          <nav className="cat-page__breadcrumb" aria-label="Fil d'Ariane">
            <Link to={homePath}>Accueil</Link>
            <span aria-hidden="true">/</span>
            <span>Catégorie introuvable</span>
          </nav>
          <p className="cat-page__empty">Catégorie introuvable.</p>
          <Link to={homePath} className="cat-page__back">← Retour à l'accueil</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cat-page">
      <div className="container">
        <nav className="cat-page__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath}>Accueil</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{category.title}</span>
        </nav>

        <div className="cat-page__header">
          <h1 className="cat-page__title">{category.title}</h1>
          <p className="cat-page__count">{total} résultat{total > 1 ? 's' : ''}</p>
        </div>

        <div className="cat-page__layout">
          <aside className="cat-page__filters">
            <h2 className="cat-page__filter-title">Filtrer</h2>

            <div className="cat-page__filter-group">
              <label htmlFor="filter-ville">Ville</label>
              <select id="filter-ville" value={ville} onChange={(e) => { setVille(e.target.value); setCurrentPage(1); }}>
                <option value="">Toutes les villes</option>
                {villes.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="cat-page__filter-group">
              <label htmlFor="filter-quartier">Quartier</label>
              <select id="filter-quartier" value={quartier} onChange={(e) => { setQuartier(e.target.value); setCurrentPage(1); }}>
                <option value="">Tous les quartiers</option>
                {quartiers.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div className="cat-page__filter-group">
              <label htmlFor="filter-chambres">Chambres</label>
              <select id="filter-chambres" value={chambres} onChange={(e) => { setChambres(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}>
                <option value="">Toutes</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3+</option>
              </select>
            </div>

            <div className="cat-page__filter-group">
              <label htmlFor="filter-dispo">Disponible</label>
              <select id="filter-dispo" value={dateDispo} onChange={(e) => { setDateDispo(e.target.value); setCurrentPage(1); }}>
                <option value="">Tous</option>
                <option value="yes">Disponible</option>
              </select>
            </div>

            <button type="button" className="cat-page__filter-reset" onClick={resetFilters}>
              Réinitialiser
            </button>
          </aside>

          <div className="cat-page__content">
            {rooms.length === 0 ? (
              <div className="cat-page__empty-state">
                <p>Aucun résultat ne correspond à vos filtres.</p>
                <button type="button" onClick={resetFilters}>Réinitialiser les filtres</button>
              </div>
            ) : (
              <div className="cat-page__grid">
                {rooms.map((room) => (
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
                    href={`${homePath}/chambre/${room.id}`}
                    badge={!room.disponible ? 'Indisponible' : room.gerantPremium ? 'Premium' : undefined}
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
              className="cat-page__pagination"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
