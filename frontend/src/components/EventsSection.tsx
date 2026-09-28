import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { fetchBannersBySection, type Banner } from '../data/banners';
import {
  fetchEventsByMarket,
  groupEventsByCity,
  formatEventDate,
  shiftIsoDate,
  type Event,
} from '../data/events';
import { fetchAvailableRooms, type Room } from '../data/rooms';
import BannerCarousel from './BannerCarousel';
import StayCard from './StayCard';
import CardSkeleton from './CardSkeleton';

// Image cassée ou absente : on masque l'élément, le fond .event-card__media
// (var(--mist-2)) reste lisible — jamais de trou blanc.
function hideBrokenImage(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.style.display = 'none';
}

export default function EventsSection() {
  const { market } = useMarket();
  const [events, setEvents] = useState<Event[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [cityFallback, setCityFallback] = useState(false);
  const [detailHeight, setDetailHeight] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);

  useEffect(() => {
    // On vide avant de recharger : sinon /ci afficherait les villes de /bj
    // pendant un render.
    setEvents([]);
    setActiveCity(null);
    setActiveSlide(0);
    setEventsLoading(true);
    fetchEventsByMarket(market)
      .then((data) => {
        setEvents(data);
        setEventsLoading(false);
      })
      .catch(() => {
        setEvents([]);
        setEventsLoading(false);
      });
  }, [market]);

  useEffect(() => {
    fetchBannersBySection(market, 'events')
      .then((data) => {
        setBanners(data);
        setBannersLoaded(true);
      })
      .catch(() => {
        setBanners([]);
        setBannersLoaded(true);
      });
  }, [market]);

  const groups = useMemo(() => groupEventsByCity(events), [events]);

  // Une carte = une ville : `city` est la clé, jamais l'index (la liste peut
  // changer de longueur après rechargement).
  const activeGroup = activeCity ? groups.find((g) => g.city === activeCity) ?? null : null;
  const slides = activeGroup?.events ?? [];
  const activeEvent = slides[activeSlide] ?? null;

  // Appartements disponibles autour de l'événement actif du carrousel :
  // fenêtre d'une semaine avant → une semaine après, dans la ville de
  // l'événement et sur son marché. Rechargé à chaque changement de slide,
  // avec garde anti-course (une réponse lente ne doit pas écraser la suivante).
  // Repli : si la ville ne donne rien, on montre tout le marché (bandeau
  // explicatif) plutôt qu'une impasse.
  useEffect(() => {
    if (!activeCity || !activeEvent) {
      setRooms([]);
      setRoomsLoading(false);
      setCityFallback(false);
      return;
    }
    let ignore = false;
    setRooms([]);
    setCityFallback(false);
    setRoomsLoading(true);
    const arrivee = shiftIsoDate(activeEvent.eventDate, -7);
    const depart = shiftIsoDate(activeEvent.eventDate, 7);
    fetchAvailableRooms(market, arrivee, depart, activeCity)
      .then(async (list) => {
        if (ignore) return;
        if (list.length > 0) {
          setRooms(list);
          return;
        }
        const all = await fetchAvailableRooms(market, arrivee, depart);
        if (ignore) return;
        setRooms(all);
        setCityFallback(all.length > 0);
      })
      .catch(() => {
        if (!ignore) setRooms([]);
      })
      .finally(() => {
        if (!ignore) setRoomsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [market, activeCity, activeEvent]);

  // Hauteur du panneau = taille réelle du contenu (scrollHeight inclut le
  // padding) : plus jamais de contenu coupé, quelle que soit la description.
  // À l'ouverture, attendre la fin des transitions du panneau (padding 0.4s,
  // border 0.3s) — une mesure à froid serait prise avec un padding partiel.
  // Mises à jour suivantes (slide, rooms) : mesure immédiate.
  useEffect(() => {
    if (!activeGroup) {
      openedAtRef.current = 0;
      return;
    }
    const panel = detailRef.current;
    if (!panel) return;

    const measure = () => setDetailHeight(panel.scrollHeight + 4);
    if (!openedAtRef.current) openedAtRef.current = Date.now();
    const wait = Math.max(0, 460 - (Date.now() - openedAtRef.current));
    const timer = wait > 0 ? setTimeout(measure, wait) : 0;
    if (wait === 0) measure();

    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [activeGroup, activeSlide, rooms, roomsLoading, cityFallback, banners]);

  const toggleCity = useCallback(
    (city: string) => {
      const willOpen = activeCity !== city;
      setActiveCity(willOpen ? city : null);
      setActiveSlide(0);
      if (willOpen) {
        setTimeout(() => {
          detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
      }
    },
    [activeCity],
  );

  const closeDetail = useCallback(() => {
    setActiveCity(null);
    setActiveSlide(0);
  }, []);

  // Au clavier : Enter et Espace ouvrent/ferment, comme sur les cartes promo.
  const handleKeyDown = (e: React.KeyboardEvent, city: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCity(city);
    }
  };

  // Section masquée seulement s'il n'y a ni événement ni bannières : des
  // bannières 'events' doivent rester visibles même sans cartes. Pendant le
  // fetch, la section reste visible avec ses skeletons.
  if (!eventsLoading && bannersLoaded && events.length === 0 && banners.length === 0) return null;

  return (
    <section className="events" id="evenements">
      <div className="container">
        <div className={`section-head section-head--row${banners.length ? ' section-head--banners' : ''} reveal`}>
          <div>
            <p className="eyebrow">Événements</p>
            <h2 className="section-title">Retrouvez-nous, <em>dans votre ville</em></h2>
            <p className="section-sub">Des événements exclusifs se déroulent régulièrement dans nos zones d'activité.</p>
          </div>
          {banners.length > 0 && <BannerCarousel banners={banners} />}
        </div>

        <div className="events__grid" aria-busy={eventsLoading}>
          {eventsLoading ? (
            <CardSkeleton count={3} />
          ) : (
            groups.map((g) => (
              <article
                key={g.city}
                className="event-card reveal"
                role="button"
                tabIndex={0}
                aria-expanded={activeCity === g.city}
                aria-controls="event-detail"
                aria-label={`${g.city} — ${g.events.length} événement${g.events.length > 1 ? 's' : ''}`}
                onClick={() => toggleCity(g.city)}
                onKeyDown={(e) => handleKeyDown(e, g.city)}
              >
                <div className="event-card__media">
                  <img src={g.cover.img} alt={g.cover.alt} loading="lazy" width="400" height="300" onError={hideBrokenImage} />
                  <div className="event-card__shade" aria-hidden="true"></div>
                  <div className="event-card__body">
                    <h3 className="event-card__title">{g.city}</h3>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div
          className={`event-detail${activeGroup ? ' is-open' : ''}`}
          id="event-detail"
          aria-hidden={!activeGroup}
          ref={detailRef}
          style={activeGroup && detailHeight > 0 ? { maxHeight: detailHeight } : undefined}
        >
          {activeGroup && (
            <>
              <button type="button" className="event-detail__close" aria-label="Fermer" onClick={closeDetail}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>

              <div className="event-detail__head">
                <span className="event-detail__marker">{activeGroup.marker}</span>
                <h3 className="event-detail__city">{activeGroup.city}</h3>
                <span className="event-detail__total">
                  {slides.length} événement{slides.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="event-detail__viewport">
                <div
                  className="event-detail__track"
                  style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                >
                  {slides.map((s) => (
                    <div className="event-slide" key={s.id}>
                      <div className="event-slide__media">
                        <img src={s.img} alt={s.alt} loading="lazy" width="640" height="420" onError={hideBrokenImage} />
                      </div>
                      <div className="event-slide__body">
                        <p className="event-slide__date">{formatEventDate(s.eventDate)}</p>
                        <h4 className="event-slide__title">{s.title}</h4>
                        <p className="event-slide__desc">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {slides.length > 1 && (
                <div className="event-carousel">
                  <button
                    type="button"
                    className="event-carousel__arrow"
                    aria-label="Événement précédent"
                    disabled={activeSlide === 0}
                    onClick={() => setActiveSlide((i) => Math.max(0, i - 1))}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6l-6 6 6 6"/></svg>
                  </button>

                  <div className="event-carousel__dots" role="tablist" aria-label="Liste des événements">
                    {slides.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={i === activeSlide}
                        aria-label={`${s.title} — ${formatEventDate(s.eventDate)}`}
                        className={`event-carousel__dot${i === activeSlide ? ' is-active' : ''}`}
                        onClick={() => setActiveSlide(i)}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className="event-carousel__arrow"
                    aria-label="Événement suivant"
                    disabled={activeSlide >= slides.length - 1}
                    onClick={() => setActiveSlide((i) => Math.min(slides.length - 1, i + 1))}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>
                  </button>
                </div>
              )}
            </>
          )}

          {activeEvent && (
            <div className="event-detail__stays">
              <div className="event-detail__stays-head">
                <div>
                  <h4 className="event-detail__stays-title">
                    Appartements disponibles à {activeCity}
                  </h4>
                  <p className="event-detail__stays-range">
                    Du <strong>{formatEventDate(shiftIsoDate(activeEvent.eventDate, -7))}</strong>{' '}
                    au <strong>{formatEventDate(shiftIsoDate(activeEvent.eventDate, 7))}</strong>
                    <span> — une semaine autour de l'événement</span>
                  </p>
                </div>
                <Link
                  className="event-detail__stays-all"
                  to={`/${market.toLowerCase()}/recherche?arrivee=${encodeURIComponent(
                    shiftIsoDate(activeEvent.eventDate, -7)
                  )}&depart=${encodeURIComponent(shiftIsoDate(activeEvent.eventDate, 7))}`}
                >
                  Voir tous les appartements
                </Link>
              </div>

              {cityFallback && (
                <p className="event-detail__stays-fallback">
                  Aucun bien trouvé à <strong>{activeCity}</strong> pour ces dates — voici les
                  disponibilités en {market === 'CI' ? "Côte d'Ivoire" : 'Bénin'}.
                </p>
              )}

              {roomsLoading ? (
                <p className="event-detail__stays-note">
                  Recherche des appartements disponibles…
                </p>
              ) : rooms.length === 0 ? (
                <p className="event-detail__stays-note">
                  Aucun appartement disponible à {activeCity} autour de cette date.
                </p>
              ) : (
                <div className="event-detail__stays-grid">
                  {rooms.slice(0, 6).map((room) => (
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
                      href={`/${market.toLowerCase()}/chambre/${room.id}?arrivee=${encodeURIComponent(
                        shiftIsoDate(activeEvent.eventDate, -7)
                      )}&depart=${encodeURIComponent(shiftIsoDate(activeEvent.eventDate, 7))}`}
                      meta={[room.capacity, `${room.chambres} chambre${room.chambres > 1 ? 's' : ''}`]}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
