import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { fetchRoomsByMarket, type Room } from '../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../data/categories';
import { fetchBannersBySection, type Banner } from '../data/banners';
import BannerCarousel from './BannerCarousel';
import CardSkeleton from './CardSkeleton';

export default function CategoriesSection() {
  const { market } = useMarket();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannersLoaded, setBannersLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // fetchCategoriesByMarket ne rejette jamais (repli sur des données
    // locales) : on peut conclure le chargement sur sa résolution.
    fetchCategoriesByMarket(market)
      .then((data) => {
        if (!alive) return;
        setCategories(data);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  useEffect(() => {
    let alive = true;
    fetchRoomsByMarket(market)
      .then((data) => {
        if (alive) setRooms(data);
      })
      .catch(() => {
        if (alive) setRooms([]);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  useEffect(() => {
    let alive = true;
    fetchBannersBySection(market, 'categories')
      .then((data) => {
        if (!alive) return;
        setBanners(data);
        setBannersLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setBanners([]);
        setBannersLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  if (!loading && bannersLoaded && categories.length === 0 && banners.length === 0) return null;

  return (
    <section className="categories" id="categories">
      <div className="container">
        <div className={`section-head section-head--row${banners.length ? ' section-head--banners' : ''} reveal`}>
          <div>
            <p className="eyebrow">Explorez par type</p>
            <h2 className="section-title">Nos offres, <em>par catégorie</em></h2>
            <p className="section-sub">Du logement abordable aux villas de luxe, en passant par l'hôtelier : explorez nos catégories.</p>
          </div>
          {banners.length > 0 && <BannerCarousel banners={banners} />}
        </div>

        <div className="categories__grid" aria-busy={loading}>
          {loading ? (
            <CardSkeleton count={4} />
          ) : (
            categories.map((cat) => {
              const count = rooms.filter((r) => r.category === cat.id).length;
              return (
                <Link key={cat.id} to={`/${market.toLowerCase()}/categorie/${cat.id}`} className="cat-card">
                  <div className="cat-card__media">
                    <img src={cat.img} alt={cat.alt} loading="lazy" width="400" height="300" />
                    <div className="cat-card__shade" aria-hidden="true"></div>
                    <span className="cat-card__badge">{count}</span>
                  </div>
                  <h3 className="cat-card__title">{cat.title}</h3>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
