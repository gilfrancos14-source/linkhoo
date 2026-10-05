import { useCallback, useEffect, useRef, useState } from 'react';
import { LANDING_SLIDES } from '../data/landing';

const INTERVAL_MS = 5000;

// Carrousel pleine largeur de la page d'accueil — structure CoinAfrique :
// fondu automatique, puces et flèches de navigation.
export default function LandingSlider() {
  const total = LANDING_SLIDES.length;
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => setActive(((index % total) + total) % total),
    [total],
  );

  useEffect(() => {
    if (total <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % total);
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total]);

  const pause = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const resume = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % total);
    }, INTERVAL_MS);
  };

  if (total === 0) return null;

  return (
    <section
      className="landing-slider"
      aria-label="En images"
      aria-roledescription="carrousel"
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="landing-slider__viewport">
        {LANDING_SLIDES.map((slide, index) => (
          <figure
            key={slide.id}
            className={`landing-slider__slide${index === active ? ' is-active' : ''}`}
            aria-hidden={index !== active}
          >
            <img
              src={slide.img}
              alt={slide.alt}
              width="1440"
              height="588"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </figure>
        ))}

        <button
          type="button"
          className="landing-slider__arrow landing-slider__arrow--prev"
          aria-label="Image précédente"
          onClick={() => goTo(active - 1)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button
          type="button"
          className="landing-slider__arrow landing-slider__arrow--next"
          aria-label="Image suivante"
          onClick={() => goTo(active + 1)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <div className="landing-slider__dots" role="tablist" aria-label="Diapositives">
          {LANDING_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Image ${index + 1} sur ${total}`}
              className={`landing-slider__dot${index === active ? ' is-active' : ''}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
