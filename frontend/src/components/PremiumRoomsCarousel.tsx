import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Room } from '../data/rooms';
import SearchStayCard from './SearchStayCard';
import Icon from './landing/icons';

interface PremiumRoomsCarouselProps {
  rooms: Room[];
  hrefFor: (room: Room) => string;
  metaFor: (room: Room) => string[];
}

const AUTOPLAY_MS = 5000;
/** Nombre de cartes visibles sur desktop : la rotation ne démarre qu'au-delà. */
const DESKTOP_SLOTS = 3;

export default function PremiumRoomsCarousel({
  rooms,
  hrefFor,
  metaFor,
}: PremiumRoomsCarouselProps) {
  const headingId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActiveState] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const total = rooms.length;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;

    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const setActive = useCallback((index: number) => {
    activeRef.current = index;
    setActiveState(index);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const slide = track?.children[index] as HTMLElement | undefined;
      if (!track || !slide) return;

      const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({ left: slide.offsetLeft, behavior });
      } else {
        track.scrollLeft = slide.offsetLeft;
      }
    },
    [reducedMotion],
  );

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      const next = ((index % total) + total) % total;
      setActive(next);
      scrollToIndex(next);
    },
    [scrollToIndex, setActive, total],
  );

  // Recalcule la carte active quand l'utilisateur fait défiler manuellement.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      Array.from(track.children).forEach((child, index) => {
        const element = child as HTMLElement;
        const nextDistance = Math.abs(element.offsetLeft - track.scrollLeft);
        if (nextDistance < distance) {
          distance = nextDistance;
          closest = index;
        }
      });
      setActive(closest);
    };

    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => track.removeEventListener('scroll', handleScroll);
  }, [setActive]);

  // Nouvelle sélection : on repart de la première carte.
  useEffect(() => {
    setActive(0);
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [rooms, setActive]);

  // Défilement automatique : uniquement s'il y a plus de cartes que de places
  // visibles sur desktop, et jamais si l'utilisateur a suspendu ou demande
  // moins d'animations.
  useEffect(() => {
    if (reducedMotion || userPaused || hovered || total <= DESKTOP_SLOTS) return;

    const timer = window.setInterval(() => {
      const next = (activeRef.current + 1) % total;
      setActive(next);
      scrollToIndex(next);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [hovered, reducedMotion, scrollToIndex, setActive, total, userPaused]);

  if (total === 0) return null;

  const autoplayEnabled = total > DESKTOP_SLOTS && !reducedMotion;
  const visibleStatus = `${active + 1} sur ${total}`;

  return (
    <section
      className="search-page__featured"
      role="region"
      aria-labelledby={headingId}
    >
      <div className="search-page__featured-head">
        <div className="search-page__featured-intro">
          <p className="search-page__featured-eyebrow">
            <Icon name="gem" size={15} />
            Mise en avant
          </p>
          <h2 className="search-page__featured-title" id={headingId}>
            Sélection premium
          </h2>
          <p className="search-page__featured-hint">
            Les adresses de nos hôtes premium sur ce marché ·{' '}
            <span aria-live="polite">{visibleStatus}</span>
          </p>
        </div>

        <div className="premium-carousel__controls">
          {autoplayEnabled && (
            <button
              type="button"
              className="premium-carousel__pause"
              aria-label={
                userPaused
                  ? 'Reprendre le défilement automatique'
                  : 'Mettre en pause le défilement automatique'
              }
              aria-pressed={userPaused}
              onClick={() => setUserPaused((value) => !value)}
            >
              <Icon name={userPaused ? 'play' : 'pause'} size={16} />
            </button>
          )}
          <button
            type="button"
            className="premium-carousel__nav"
            aria-label="Chambre précédente"
            onClick={() => goTo(active - 1)}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            className="premium-carousel__nav"
            aria-label="Chambre suivante"
            onClick={() => goTo(active + 1)}
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>

      <div
        className="premium-carousel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={() => setHovered(false)}
        onTouchStart={() => setHovered(true)}
        onTouchEnd={() => setHovered(false)}
      >
        <div className="premium-carousel__viewport">
          <div className="premium-carousel__track" ref={trackRef}>
            {rooms.map((room, index) => (
              <div
                key={room.id}
                className="premium-carousel__item"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} sur ${total}`}
              >
                <SearchStayCard
                  room={room}
                  href={hrefFor(room)}
                  meta={metaFor(room)}
                  variant="featured"
                />
              </div>
            ))}
          </div>
        </div>

        {total > 1 && (
          <div className="premium-carousel__dots" role="group" aria-label="Navigation du carrousel">
            {rooms.map((room, index) => (
              <button
                key={room.id}
                type="button"
                className={`premium-carousel__dot${index === active ? ' is-active' : ''}`}
                aria-label={`Aller à la chambre ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
