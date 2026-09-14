import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Banner } from '../data/banners';

interface BannerCarouselProps {
  banners: Banner[];
}

export default function BannerCarousel({ banners }: BannerCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  const total = banners.length;

  const updateActive = useCallback(() => {
    if (!trackRef.current) return;
    const cards = trackRef.current.querySelectorAll('.banner-carousel__item');
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs((card as HTMLElement).offsetLeft - trackRef.current!.scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActive(closest);
  }, []);

  const scrollTo = (idx: number) => {
    if (!trackRef.current) return;
    const cards = trackRef.current.querySelectorAll('.banner-carousel__item');
    const target = cards[idx] as HTMLElement;
    if (target) {
      trackRef.current.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (total <= 1 || isMobile) return;
    const start = () => {
      timerRef.current = setInterval(() => {
        setActive((prev) => {
          const next = (prev + 1) % total;
          scrollTo(next);
          return next;
        });
      }, 5000);
    };
    start();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [total, isMobile]);

  const pauseAuto = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const resumeAuto = () => {
    if (total <= 1 || isMobile) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % total;
        scrollTo(next);
        return next;
      });
    }, 5000);
  };

  // Pause on touch
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('touchstart', pauseAuto, { passive: true });
    el.addEventListener('touchend', resumeAuto, { passive: true });
    return () => {
      el.removeEventListener('touchstart', pauseAuto);
      el.removeEventListener('touchend', resumeAuto);
    };
  }, [total, isMobile]);

  // Track scroll for active dot
  useEffect(() => {
    const el = trackRef.current;
    if (!el || total <= 1) return;
    el.addEventListener('scroll', updateActive, { passive: true });
    return () => el.removeEventListener('scroll', updateActive);
  }, [updateActive, total]);

  if (total === 0) return null;

  return (
    <div
      className="banner-carousel"
      onMouseEnter={pauseAuto}
      onMouseLeave={resumeAuto}
      role="region"
      aria-label="Bannières promotionnelles"
    >
      <div className="banner-carousel__track" ref={trackRef}>
        {banners.map((b) => (
          <Link key={b.id} to={b.link} className="banner-carousel__item">
            <img src={b.img} alt={b.alt} loading="lazy" width="580" height="120" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </Link>
        ))}
      </div>

      {total > 1 && (
        <div className="banner-carousel__dots" role="tablist" aria-label="Diapositives">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={`banner-carousel__dot${i === active ? ' is-active' : ''}`}
              aria-label={`Bannière ${i + 1}`}
              onClick={() => { scrollTo(i); setActive(i); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
