import { useState, useEffect, useMemo } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { apiRooms, type RoomData } from '../lib/api';
import { fetchBannersBySection, type Banner } from '../data/banners';
import StayCard from './StayCard';
import BannerCarousel from './BannerCarousel';

export default function PopularSection() {
  const { market } = useMarket();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    apiRooms.getPopular(market).then(setRooms).catch(() => setRooms([]));
  }, [market]);

  useEffect(() => {
    fetchBannersBySection(market, 'popular').then(setBanners);
  }, [market]);

  const popularItems = useMemo(() => {
    return rooms.map((room) => ({
      image: room.img,
      alt: room.alt,
      title: room.title,
      rating: room.quartier,
      description: room.subtitle,
      price: room.price,
      priceUnit: room.price_unit,
      roomId: room.id,
      disponible: room.disponible,
      dateDispo: room.date_dispo,
    }));
  }, [rooms]);

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

        <div className="popular__track">
          {popularItems.map((item) => (
            <StayCard
              key={item.roomId}
              image={item.image}
              alt={item.alt}
              title={item.title}
              rating={item.rating}
              description={item.description}
              price={item.price}
              priceUnit={item.priceUnit}
              href={`/${market.toLowerCase()}/chambre/${item.roomId}`}
              badge={item.disponible ? undefined : 'Indisponible'}
              badgeVariant={item.disponible ? 'default' : 'unavailable'}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
