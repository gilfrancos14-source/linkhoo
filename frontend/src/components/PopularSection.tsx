import { useState, useEffect, useMemo } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { apiRooms, type RoomData } from '../lib/api';
import { roomMeta, roomSubtitle } from '../lib/roomDisplay';
import { fetchBannersBySection, type Banner } from '../data/banners';
import StayCard from './StayCard';
import BannerCarousel from './BannerCarousel';
import CardSkeleton from './CardSkeleton';

export default function PopularSection() {
  const { market } = useMarket();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bannersLoaded, setBannersLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    apiRooms
      .getPopular(market)
      .then((data) => {
        if (!alive) return;
        setRooms(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!alive) return;
        setRooms([]);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [market]);

  useEffect(() => {
    let alive = true;
    fetchBannersBySection(market, 'popular')
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

  const popularItems = useMemo(() => {
    return rooms.map((room) => ({
      image: room.img,
      alt: room.alt,
      title: room.title,
      rating: room.quartier,
      description: roomSubtitle(room),
      meta: roomMeta(room),
      price: room.price,
      priceUnit: room.price_unit,
      roomId: room.id,
      disponible: room.disponible,
      dateDispo: room.date_dispo,
    }));
  }, [rooms]);

  // Erreur : on masque la section plutôt que d'afficher un bloc vide.
  if (status === 'error') return null;
  // Rien à afficher (ni biens ni bannières) : la section n'a pas lieu d'être.
  // On attend les deux fetchs pour ne pas faire apparaître/disparaître la
  // section selon l'ordre des réponses.
  if (status === 'ready' && bannersLoaded && rooms.length === 0 && banners.length === 0) return null;

  return (
    <section className="popular" id="plus-loues">
      <div className="container">
        <div className={`section-head section-head--row${banners.length ? ' section-head--banners' : ''} reveal`}>
          <div>
            <p className="eyebrow">Les plus loués</p>
            <h2 className="section-title">Nos biens les <em>plus demandés</em></h2>
          </div>
          {banners.length > 0 && <BannerCarousel banners={banners} />}
        </div>

        <div className="popular__track" aria-busy={status === 'loading'}>
          {status === 'loading' ? (
            <CardSkeleton count={4} />
          ) : (
            popularItems.map((item) => (
              <StayCard
                key={item.roomId}
                image={item.image}
                alt={item.alt}
                title={item.title}
                rating={item.rating}
                description={item.description}
                meta={item.meta}
                price={item.price}
                priceUnit={item.priceUnit}
                href={`/${market.toLowerCase()}/chambre/${item.roomId}`}
                badge={item.disponible ? undefined : 'Indisponible'}
                badgeVariant={item.disponible ? 'default' : 'unavailable'}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
