import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MARKETS } from '../../config/markets';
import { useFavorites } from '../../contexts/FavoritesContext';
import { apiDiscover, type RoomData } from '../../lib/api';
import { formatPrice } from '../../lib/roomDisplay';
import Icon from './icons';
import '../../styles/51-landing-local-rooms.css';

interface Props {
  limit?: number;
  variant?: 'local' | 'neighbor';
}

/**
 * Deux sections géolocalisées de la landing : logements du pays du visiteur
 * (`local`) et du pays voisin le plus proche (`neighbor`). Même présentation
 * éditoriale : carrousel de cartes photo + tuile « Tout afficher ».
 */
export default function LandingLocalRooms({ limit = 4, variant = 'local' }: Props) {
  const { t } = useTranslation();
  const keys = variant === 'neighbor' ? 'landing.neighborRooms' : 'landing.localRooms';
  const favorites = useFavorites();
  const gridRef = useRef<HTMLDivElement>(null);
  const [market, setMarket] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomData[]>([]);

  useEffect(() => {
    let alive = true;
    const loader =
      variant === 'neighbor' ? apiDiscover.neighborRooms : apiDiscover.localRooms;
    loader(limit)
      .then((data) => {
        if (!alive || !data?.market || !Array.isArray(data.rooms)) return;
        setMarket(data.market);
        setRooms(data.rooms.slice(0, limit));
      })
      .catch(() => {
        // silencieux : la section reste masquée, le reste de la page est intact
      });
    return () => {
      alive = false;
    };
  }, [limit, variant]);

  const scroll = (direction: -1 | 1) => {
    const grid = gridRef.current;
    if (!grid) return;
    const card = grid.querySelector<HTMLElement>('.acc-local__card');
    const step = (card?.offsetWidth ?? 200) + 12;
    grid.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  if (!market || rooms.length === 0) return null;

  const slug = MARKETS.find((item) => item.code === market)?.slug ?? market.toLowerCase();
  const countryName = t(`markets.${market}`);
  const showAllLabel = t(`${keys}.viewAll`, { country: countryName });

  return (
    <section
      className={`acc-local${variant === 'neighbor' ? ' acc-local--neighbor' : ''}`}
      aria-labelledby={`acc-local-title-${variant}`}
    >
      <div className="acc-container">
        <div className="acc-local__head">
          <div className="acc-local__heading">
            <h2 id={`acc-local-title-${variant}`} className="acc-local__title">
              {t(`${keys}.title`, { country: countryName })}
              <Link
                to={`/${slug}`}
                className="acc-local__all"
                aria-label={showAllLabel}
                title={showAllLabel}
              >
                <Icon name="arrowRight" size={16} />
              </Link>
            </h2>
          </div>

          <div className="acc-local__nav">
            <button
              type="button"
              className="acc-local__nav-btn"
              aria-label={t(`${keys}.prev`)}
              onClick={() => scroll(-1)}
            >
              <Icon name="chevronLeft" size={15} />
            </button>
            <button
              type="button"
              className="acc-local__nav-btn"
              aria-label={t(`${keys}.next`)}
              onClick={() => scroll(1)}
            >
              <Icon name="chevronRight" size={15} />
            </button>
          </div>
        </div>

        <div className="acc-local__grid" ref={gridRef}>
          {rooms.map((room, index) => {
            const favorite = favorites.isFavorite(room.id);
            return (
              <Link
                key={room.id}
                to={`/${slug}/chambre/${encodeURIComponent(room.id)}`}
                className="acc-local__card"
              >
                <div className="acc-local__media">
                  <img src={room.img} alt={room.alt || room.title} loading="lazy" />
                  {room.is_popular && (
                    <span className="acc-local__badge">{t(`${keys}.badge`)}</span>
                  )}
                  <button
                    type="button"
                    className={`acc-local__heart${favorite ? ' acc-local__heart--active' : ''}`}
                    aria-label={favorite ? room.title : room.title}
                    aria-pressed={favorite}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void favorites.toggle(room.id);
                    }}
                  >
                    <Icon name="heart" size={17} />
                  </button>
                </div>
                <div className="acc-local__body">
                  <p className="acc-local__name">
                    {t(`${keys}.property`)} · {room.ville || room.quartier}
                  </p>
                  <p className="acc-local__price">
                    {formatPrice(room.price)} {t(`${keys}.currency`)}{' '}
                    {room.price_unit || `/ ${t(`${keys}.night`)}`}
                  </p>
                </div>
                <span className="acc-local__sr">{String(index + 1).padStart(2, '0')}</span>
              </Link>
            );
          })}

          <Link to={`/${slug}`} className="acc-local__showall">
            <span className="acc-local__stack" aria-hidden="true">
              {rooms.slice(0, 3).map((room, index) => (
                <img
                  key={room.id}
                  src={room.img}
                  alt=""
                  className={`acc-local__stack-img acc-local__stack-img--${index + 1}`}
                  loading="lazy"
                />
              ))}
            </span>
            <span className="acc-local__showall-label">{t(`${keys}.showAll`)}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
