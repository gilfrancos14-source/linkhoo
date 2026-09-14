import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { fetchRoomsByMarket, type Room } from '../data/rooms';
import { fetchBannersBySection, type Banner } from '../data/banners';
import BannerCarousel from './BannerCarousel';

interface PromoRoom {
  title: string;
  info: string;
  priceAmount: string;
  priceUnit: string;
  img: string;
  alt: string;
  roomId: string;
}

interface PromoData {
  title: string;
  text: string;
  rooms: PromoRoom[];
}

const PROMO_CATEGORIES: Record<string, { moinsChers: string; hotel: string; premium: string }> = {
  BJ: { moinsChers: 'appartements-moins-chers', hotel: 'hotel', premium: 'appartements-premium' },
  CI: { moinsChers: 'ci-chambres-moins-chères', hotel: 'ci-chambres-premium', premium: 'ci-appartements' },
};

export default function PromosSection() {
  const { market } = useMarket();
  const [activePromo, setActivePromo] = useState<number | null>(null);
  const roomsRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [prevDisabled, setPrevDisabled] = useState(true);
  const [nextDisabled, setNextDisabled] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    fetchRoomsByMarket(market).then(setRooms);
  }, [market]);

  useEffect(() => {
    fetchBannersBySection(market, 'promos').then(setBanners);
  }, [market]);

  const promoData = useMemo((): PromoData[] => {
    const cats = PROMO_CATEGORIES[market] ?? PROMO_CATEGORIES.BJ;
    const moinsChers = rooms.filter((r) => r.category === cats.moinsChers).slice(0, 5);
    const hotel = rooms.filter((r) => r.category === cats.hotel).slice(0, 4);
    const premium = rooms.filter((r) => r.category === cats.premium).slice(0, 4);

    const toPromoRoom = (room: Room): PromoRoom => ({
      title: room.title,
      info: room.info,
      priceAmount: `${room.priceNum} FCFA`,
      priceUnit: room.priceUnit,
      img: room.img,
      alt: room.alt,
      roomId: room.id,
    });

    return [
      {
        title: 'Nos offres promotionnelles à -15 %',
        text: 'Profitez de 15 % de réduction sur une sélection de biens spacieux. Idéal pour les familles.',
        rooms: moinsChers.map(toPromoRoom),
      },
      {
        title: 'Nos offres promotionnelles à -10 %',
        text: '10 % de réduction sur nos suites prestige. Salon séparé, vue dégagée et petit-déjeuner inclus.',
        rooms: hotel.map(toPromoRoom),
      },
      {
        title: 'Nos offres promotionnelles à -5 %',
        text: '5 % de réduction sur nos appartements premium. Parfait pour un séjour avec tout le confort.',
        rooms: premium.map(toPromoRoom),
      },
    ].filter((p) => p.rooms.length > 0);
  }, [market, rooms]);

  const promoCards = useMemo(() => {
    const colors = ['-15 %', '-10 %', '-5 %'];
    return promoData.map((p, i) => ({
      img: p.rooms[0]?.img || '',
      alt: p.rooms[0]?.alt || '',
      badge: colors[i] || '-5 %',
    }));
  }, [promoData]);

  const updateNav = useCallback(() => {
    if (!roomsRef.current) return;
    const el = roomsRef.current;
    const scrollLeft = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setPrevDisabled(scrollLeft <= 4);
    setNextDisabled(scrollLeft >= maxScroll - 4);

    const cards = el.querySelectorAll('.promo-room');
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs((card as HTMLElement).offsetLeft - 8 - scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveDot(closest);
  }, []);

  useEffect(() => {
    const el = roomsRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateNav, { passive: true });
    return () => el.removeEventListener('scroll', updateNav);
  }, [updateNav, activePromo]);

  const openPromo = (idx: number) => {
    if (activePromo === idx) {
      setActivePromo(null);
      return;
    }
    setActivePromo(idx);
    setTimeout(() => {
      if (roomsRef.current) roomsRef.current.scrollLeft = 0;
      updateNav();
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const closePromo = () => setActivePromo(null);

  const scrollRooms = (direction: 'prev' | 'next') => {
    if (!roomsRef.current) return;
    const card = roomsRef.current.querySelector('.promo-room') as HTMLElement;
    const step = card ? card.offsetWidth + 16 : 296;
    roomsRef.current.scrollBy({ left: direction === 'prev' ? -step : step, behavior: 'smooth' });
  };

  const goToSlide = (idx: number) => {
    if (!roomsRef.current) return;
    const cards = roomsRef.current.querySelectorAll('.promo-room');
    const target = cards[idx] as HTMLElement;
    if (target) {
      roomsRef.current.scrollTo({ left: target.offsetLeft - 8, behavior: 'smooth' });
    }
  };

  const currentData = activePromo !== null ? promoData[activePromo] : null;

  return (
    <section className="promos" id="promos">
      <div className="container">
        <div className={`section-head section-head--row${banners.length ? ' section-head--banners' : ''} reveal`}>
          <div>
            <p className="eyebrow">Offres promotionnelles</p>
            <h2 className="section-title">Des prix exceptionnels,<br /><em>pour une durée donnée</em></h2>
            <p className="section-sub">Profitez de réductions exclusives sur une sélection de nos biens et chambres d'hôtel.</p>
          </div>
          {banners.length > 0 && <BannerCarousel banners={banners} />}
        </div>

        <div className="promos__grid">
          {promoCards.map((card, i) => (
            <article
              key={i}
              className="promo-card reveal"
              role="button"
              tabIndex={0}
              onClick={() => openPromo(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPromo(i); } }}
            >
              <div className="promo-card__media">
                <img src={card.img} alt={card.alt} loading="lazy" width="400" height="300" />
                <span className="promo-card__badge">{card.badge}</span>
              </div>
            </article>
          ))}
        </div>

        <div className={`promo-detail${activePromo !== null ? ' is-open' : ''}`} id="promo-detail" aria-hidden={activePromo === null} ref={detailRef}>
          <button type="button" className="promo-detail__close" aria-label="Fermer" onClick={closePromo}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div className="promo-detail__content">
            <h3 className="promo-detail__title">{currentData?.title}</h3>
            <p className="promo-detail__text">{currentData?.text}</p>
            <div className="promo-carousel">
              <button type="button" className="promo-carousel__arrow promo-carousel__arrow--prev" aria-label="Précédent" disabled={prevDisabled} onClick={() => scrollRooms('prev')}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6l-6 6 6 6"/></svg>
              </button>
              <div className="promo-detail__rooms" ref={roomsRef}>
                {currentData?.rooms.map((room, i) => (
                  <Link key={i} to={`/${market.toLowerCase()}/chambre/${room.roomId}`} className="promo-room">
                    <img className="promo-room__img" src={room.img} alt={room.alt} loading="lazy" width="280" height="175" />
                    <div className="promo-room__body">
                      <p className="promo-room__title">{room.title}</p>
                      <p className="promo-room__info">{room.info}</p>
                      <p className="promo-room__price">dès <strong>{room.priceAmount}</strong> {room.priceUnit}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <button type="button" className="promo-carousel__arrow promo-carousel__arrow--next" aria-label="Suivant" disabled={nextDisabled} onClick={() => scrollRooms('next')}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>
              </button>
            </div>
            <div className="promo-carousel__dots" role="tablist" aria-label="Diapositives du carrousel">
              {currentData && currentData.rooms.length > 1 && currentData.rooms.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`promo-carousel__dot${i === activeDot ? ' is-active' : ''}`}
                  aria-label={`Diapositive ${i + 1}`}
                  onClick={() => goToSlide(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
