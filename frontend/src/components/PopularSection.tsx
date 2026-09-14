import { useState, useEffect, useMemo } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { fetchRoomsByMarket, type Room } from '../data/rooms';
import { fetchBannersBySection, type Banner } from '../data/banners';
import StayCard from './StayCard';
import BannerCarousel from './BannerCarousel';

const POPULAR_IDS: Record<string, readonly string[]> = {
  BJ: [
    'lumineux-centre-ville-studio',
    'cosy-quartier-des-arts',
    'familial-quartier-des-arts',
    'vue-mer-corniche',
    'suite-prestige-front-de-mer',
    'suite-vue-mer-top-floor',
  ],
  CI: [
    'abidjan-plateau-moderne',
    'abidjan-cocody-studio',
    'abidjan-marcoral-ville',
    'abidjan-treichville-studio',
    'bouake-centre-appart',
    'yamoussoukro-paix-chambre',
  ],
};

export default function PopularSection() {
  const { market } = useMarket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    fetchRoomsByMarket(market).then(setRooms);
  }, [market]);

  useEffect(() => {
    fetchBannersBySection(market, 'popular').then(setBanners);
  }, [market]);

  const popularItems = useMemo(() => {
    const ids = POPULAR_IDS[market] ?? POPULAR_IDS.BJ;
    return ids
      .map((id) => rooms.find((r) => r.id === id))
      .filter(Boolean)
      .map((room) => ({
        image: room!.img,
        alt: room!.alt,
        title: room!.title,
        rating: room!.quartier,
        description: room!.subtitle,
        price: room!.price,
        priceUnit: room!.priceUnit,
        roomId: room!.id,
        disponible: room!.disponible,
        dateDispo: room!.dateDispo,
      }));
  }, [market, rooms]);

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
