import { useParams, Link } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { fetchRoomsByMarket, getVillesFromRooms, getQuartiersFromRooms, type Room } from '../data/rooms';
import { fetchCategoriesByMarket } from '../data/categories';
import StayCard from '../components/StayCard';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 6;

export default function CategoryPage() {
  const { market } = useMarket();
  const { id } = useParams<{ id: string }>();
  const homePath = useHomePath();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const category = categories.find((c: any) => c.id === id);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRoomsByMarket(market),
      fetchCategoriesByMarket(market),
    ]).then(([r, c]) => {
      setRooms(r);
      setCategories(c);
    }).catch(() => {
      setRooms([]);
      setCategories([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [market]);

  const categoryRooms = useMemo(() => {
    return rooms.filter((r) => r.category === id);
  }, [rooms, id]);

  const villes = useMemo(() => getVillesFromRooms(rooms), [rooms]);
  const quartiers = useMemo(() => getQuartiersFromRooms(rooms), [rooms]);

  const [ville, setVille] = useState('');
  const [quartier, setQuartier] = useState('');
  const [chambres, setChambres] = useState<number | ''>('');
  const [dateDispo, setDateDispo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setVille('');
    setQuartier('');
    setChambres('');
    setDateDispo('');
    setCurrentPage(1);
  }, [id]);

  const filteredRooms = useMemo(() => {
    return categoryRooms.filter((room) => {
      if (ville && room.ville !== ville) return false;
      if (quartier && room.quartier !== quartier) return false;
      if (chambres !== '') {
        if (chambres === 3 ? room.chambres < 3 : room.chambres !== chambres) return false;
      }
      if (dateDispo && !room.disponible) return false;
      return true;
    });
  }, [categoryRooms, ville, quartier, chambres, dateDispo]);

  const totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);
  const paginatedRooms = filteredRooms.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
          <p className="cat-page__count">{filteredRooms.length} résultat{filteredRooms.length > 1 ? 's' : ''}</p>
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
            {paginatedRooms.length === 0 ? (
              <div className="cat-page__empty-state">
                <p>Aucun résultat ne correspond à vos filtres.</p>
                <button type="button" onClick={resetFilters}>Réinitialiser les filtres</button>
              </div>
            ) : (
              <div className="cat-page__grid">
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
                    href={`${homePath}/chambre/${room.id}`}
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
              className="cat-page__pagination"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
