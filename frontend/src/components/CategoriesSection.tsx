import { Link } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { getRoomsByMarket } from '../data/rooms';
import { getCategoriesByMarket } from '../data/categories';
import { getBannersBySection } from '../data/banners';
import BannerCarousel from './BannerCarousel';

export default function CategoriesSection() {
  const { market } = useMarket();
  const categories = getCategoriesByMarket(market);
  const rooms = getRoomsByMarket(market);
  const banners = getBannersBySection(market, 'categories');

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

        <div className="categories__grid">
          {categories.map((cat) => {
            const count = rooms.filter((r) => r.category === cat.id).length;
            return (
              <Link key={cat.id} to={`/${market.toLowerCase()}/categorie/${cat.id}`} className="cat-card reveal">
                <div className="cat-card__media">
                  <img src={cat.img} alt={cat.alt} loading="lazy" width="400" height="300" />
                  <div className="cat-card__shade" aria-hidden="true"></div>
                  <span className="cat-card__badge">{count}</span>
                </div>
                <h3 className="cat-card__title">{cat.title}</h3>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
