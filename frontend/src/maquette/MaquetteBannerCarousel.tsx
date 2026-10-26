import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BannerSlide } from './viewModel';

interface MaquetteBannerCarouselProps {
  banners: BannerSlide[];
}

function isExternal(link: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(link);
}

export default function MaquetteBannerCarousel({ banners }: MaquetteBannerCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [active, setActive] = useState(0);

  const total = banners.length;

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[index] as HTMLElement | undefined;
    if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  }, []);

  const stopAuto = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startAuto = useCallback(() => {
    stopAuto();
    if (total <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % total;
        scrollTo(next);
        return next;
      });
    }, 5000);
  }, [scrollTo, stopAuto, total]);

  useEffect(() => {
    setActive(0);
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [banners]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
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

    track.addEventListener('scroll', update, { passive: true });
    return () => track.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)').matches;
    if (!desktop) return;
    startAuto();
    return stopAuto;
  }, [startAuto, stopAuto]);

  useEffect(() => () => stopAuto(), [stopAuto]);

  if (total === 0) return null;

  return (
    <div
      className="relative w-full sm:w-[380px] lg:w-[460px] shrink-0 rounded-2xl overflow-hidden bg-slate-100"
      role="region"
      aria-label="Bannières promotionnelles"
      onMouseEnter={stopAuto}
      onMouseLeave={startAuto}
      onTouchStart={stopAuto}
      onTouchEnd={startAuto}
    >
      <div ref={trackRef} className="flex h-24 overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {banners.map((banner) => {
          const image = (
            <img
              alt={banner.alt}
              className="w-full h-full object-cover"
              src={banner.image}
              loading="lazy"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
            />
          );

          return isExternal(banner.link) ? (
            <a
              key={banner.id}
              className="w-full h-full shrink-0 snap-start block"
              href={banner.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {image}
            </a>
          ) : (
            <Link
              key={banner.id}
              className="w-full h-full shrink-0 snap-start block"
              to={banner.link}
            >
              {image}
            </Link>
          );
        })}
      </div>

      {total > 1 && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
          role="tablist"
          aria-label="Diapositives"
        >
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              className={`w-1.5 h-1.5 rounded-full transition ${
                index === active ? 'bg-white scale-125' : 'bg-white/50'
              }`}
              aria-label={`Bannière ${index + 1}`}
              aria-selected={index === active}
              role="tab"
              onClick={() => {
                setActive(index);
                scrollTo(index);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
