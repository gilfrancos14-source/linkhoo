import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { fetchRoomsByMarket, type Room } from '../data/rooms';
import { fetchBannersBySection, type Banner } from '../data/banners';
import BannerCarousel from './BannerCarousel';
import CardSkeleton from './CardSkeleton';

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

const PROMO_CONFIG: { group: string; title: string; text: string }[] = [
  { group: 'promo_15', title: 'Nos offres promotionnelles à -15 %', text: 'Profitez de 15 % de réduction sur une sélection de biens spacieux. Idéal pour les familles.' },
  { group: 'promo_10', title: 'Nos offres promotionnelles à -10 %', text: '10 % de réduction sur nos suites prestige. Salon séparé, vue dégagée et petit-déjeuner inclus.' },
  { group: 'promo_5', title: 'Nos offres promotionnelles à -5 %', text: '5 % de réduction sur nos appartements premium. Parfait pour un séjour avec tout le confort.' },
];

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
  const [roomsLoading, setRoomsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setRoomsLoading(true);
    fetchRoomsByMarket(market)
      .then((data) => {
        if (alive) setRooms(data);
      })
      .catch(() => {
        if (alive) setRooms([]);
      })
      .finally(() => {
        if (alive) setRoomsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  useEffect(() => {
    let alive = true;
    fetchBannersBySection(market, 'promos')
      .then((data) => {
        if (alive) setBanners(data);
      })
      .catch(() => {
        if (alive) setBanners([]);
      });
    return () => {
      alive = false;
    };
  }, [market]);

  const promoData = useMemo((): PromoData[] => {
    const now = new Date();

    const isActive = (r: Room) => {
      if (!r.promoGroup) return false;
      if (r.promoStart && new Date(r.promoStart) > now) return false;
      if (r.promoEnd && new Date(r.promoEnd) < now) return false;
      return true;
    };

    return PROMO_CONFIG.map((cfg) => {
      const promoRooms = rooms.filter((r) => r.promoGroup === cfg.group && isActive(r));

      const toPromoRoom = (room: Room): PromoRoom => ({
        title: room.title,
        info: room.info,
        priceAmount: `${room.priceNum} FCFA`,
        priceUnit: room.priceUnit,
        img: room.img,
        alt: room.alt,
        roomId: room.id,
      });

      return {
        title: cfg.title,
        text: cfg.text,
        rooms: promoRooms.map(toPromoRoom),
      };
    });
  }, [market, rooms]);

  const promoCards = useMemo(() => {
    const colors = ['-15 %', '-10 %', '-5 %'];
    const placeholders = [
      '/images/pexels-artbovich-7214173.jpg',
      '/images/pexels-artbovich-7045712.jpg',
      '/images/pexels-artbovich-6782567.jpg',
    ];
    return promoData.map((p, i) => ({
      img: p.rooms[0]?.img || placeholders[i],
      alt: p.rooms[0]?.alt || p.title,
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

        <div className="promos__grid" aria-busy={roomsLoading}>
          {roomsLoading ? (
            <CardSkeleton count={3} />
          ) : (
            promoCards.map((card, i) => (
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
            ))
          )}
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
                {currentData && currentData.rooms.length > 0 ? (
                  currentData.rooms.map((room, i) => (
                    <Link key={i} to={`/${market.toLowerCase()}/chambre/${room.roomId}`} className="promo-room">
                      <img className="promo-room__img" src={room.img} alt={room.alt} loading="lazy" width="280" height="175" />
                      <div className="promo-room__body">
                        <p className="promo-room__title">{room.title}</p>
                        <p className="promo-room__info">{room.info}</p>
                        <p className="promo-room__price">dès <strong>{room.priceAmount}</strong> {room.priceUnit}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-soft, #888)', width: '100%' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                      <circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                    </svg>
                    <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>Pas d'offre disponible pour le moment</p>
                    <p style={{ fontSize: '13px', marginTop: '4px', opacity: 0.7 }}>Revenez bientôt pour découvrir nos prochaines promotions.</p>
                  </div>
                )}
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
