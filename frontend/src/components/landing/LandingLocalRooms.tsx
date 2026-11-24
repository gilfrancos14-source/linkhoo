import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MARKETS } from '../../config/markets';
import { apiDiscover } from '../../lib/api';
import { formatPrice } from '../../lib/roomDisplay';
import Icon from './icons';
import '../../styles/51-landing-local-rooms.css';

interface Props {
  /** Nombre de cartes à afficher (4 par défaut). */
  limit?: number;
}

/**
 * Section « À louer près de chez vous » : le backend déduit le marché du pays
 * de l'IP du visiteur. Sans pays reconnu ou sans logement disponible, la
 * section ne s'affiche pas du tout — on ne montre jamais un faux localisme.
 */
export default function LandingLocalRooms({ limit = 4 }: Props) {
  const { t } = useTranslation();
  const [market, setMarket] = useState<string | null>(null);
  const [rooms, setRooms] = useState<
    { id: string; title: string; img: string; alt: string; ville: string; quartier: string; price: string }[]
  >([]);

  useEffect(() => {
    let alive = true;
    apiDiscover
      .localRooms(limit)
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
  }, [limit]);

  if (!market || rooms.length === 0) return null;

  const slug = MARKETS.find((item) => item.code === market)?.slug ?? market.toLowerCase();
  const countryName = t(`markets.${market}`);

  return (
    <section className="acc-local" aria-labelledby="acc-local-title">
      <div className="acc-container">
        <div className="acc-local__head">
          <div>
            <p className="acc-local__eyebrow">
              <Icon name="mapPin" size={18} />
              {t('landing.localRooms.eyebrow', { country: countryName })}
            </p>
            <h2 id="acc-local-title" className="acc-local__title">
              {t('landing.localRooms.title', { country: countryName })}
            </h2>
            <p className="acc-local__subtitle">
              {t('landing.localRooms.subtitle', { country: countryName })}
            </p>
          </div>
          <Link to={`/${slug}`} className="acc-local__all">
            {t('landing.localRooms.viewAll', { country: countryName })}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <div className="acc-local__grid">
          {rooms.map((room) => (
            <Link
              key={room.id}
              to={`/${slug}/chambre/${encodeURIComponent(room.id)}`}
              className="acc-local__card"
            >
              <div className="acc-local__media">
                {room.img ? (
                  <img src={room.img} alt={room.alt || room.title} loading="lazy" />
                ) : (
                  <span className="acc-local__placeholder"><Icon name="house" size={28} /></span>
                )}
              </div>
              <div className="acc-local__body">
                <p className="acc-local__place">
                  <Icon name="mapPin" size={12} />
                  {[room.quartier, room.ville].filter(Boolean).join(' · ')}
                </p>
                <h3 className="acc-local__name">{room.title}</h3>
                {room.price && (
                  <p className="acc-local__price">
                    {t('landing.localRooms.from')} <strong>{formatPrice(room.price)} FCFA</strong>
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
