import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketCode } from '../../config/markets';
import { apiBanners, type BannerData } from '../../lib/api';
import './partner-banners.css';

interface PartnerBannersProps {
  className?: string;
  /** Marché dont on affiche les publicités ; absent = tous les marchés. */
  market?: MarketCode;
}

interface HeroSlide {
  readonly id: string;
  readonly image?: string;
  readonly alt: string;
  readonly link?: string;
  readonly gradientIndex: number;
}

const FALLBACK_KEYS = ['partnerAds.slide1', 'partnerAds.slide2', 'partnerAds.slide3'] as const;
const ROTATION_MS = 4000;

function asSlides(items: BannerData[], defaultAlt: string): HeroSlide[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.id === 'string' && typeof item.img === 'string' && item.img.length > 0)
    .map((item, position) => ({
      id: item.id,
      image: item.img,
      alt: item.alt || defaultAlt,
      link: typeof item.link === 'string' && item.link.length > 0 ? item.link : undefined,
      gradientIndex: position % 3,
    }));
}

/**
 * Espace publicitaire circulaire du hero : les visuels sont ceux que
 * l'administrateur publie dans /admin/banners (section « hero »).
 * Tant qu'il n'en a pas publié, des offres d'exemple traduites prennent le relais.
 */
export default function PartnerBanners({ className = '', market }: PartnerBannersProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.split('-')[0];
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    apiBanners
      .list(market, 'hero')
      .then((items) => {
        if (!alive) return;
        setBanners(items);
        setIndex(0);
      })
      .catch(() => {
        if (alive) setBanners([]);
      });
    return () => {
      alive = false;
    };
  }, [market, language]);

  const adminSlides = asSlides(banners, t('partnerAds.defaultAlt'));
  const fallbackSlides: HeroSlide[] = FALLBACK_KEYS.map((key, position) => ({
    id: key,
    alt: t(key),
    gradientIndex: position,
  }));
  const slides = adminSlides.length > 0 ? adminSlides : fallbackSlides;
  const slideCount = slides.length;

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [slideCount]);

  // Le nombre de publicités peut diminuer après une mise à jour admin.
  const activeIndex = index % slideCount;

  return (
    <div className={`partner-banners ${className}`} aria-label={t('partnerAds.aria')}>
      <div className="partner-banners__slides">
        {slides.map((slide, position) => {
          const content = (
            <>
              {/* Repli texte : visible si le visuel est absent ou ne charge pas. */}
              <div className={`partner-banners__fallback partner-banners__slide--${slide.gradientIndex}`}>
                <span className="partner-banners__label">{t('partnerAds.label')}</span>
                <strong>{slide.alt}</strong>
                <span className="partner-banners__cta">{t('partnerAds.discover')}</span>
              </div>
              {slide.image && (
                <img
                  className={`partner-banners__img${loaded[slide.id] ? ' is-loaded' : ''}`}
                  src={slide.image}
                  alt={slide.alt}
                  decoding="async"
                  onLoad={() => setLoaded((current) => ({ ...current, [slide.id]: true }))}
                  onError={() => setLoaded((current) => ({ ...current, [slide.id]: false }))}
                />
              )}
            </>
          );

          return (
            <div
              key={slide.id}
              className={`partner-banners__slide${position === activeIndex ? ' is-active' : ''}`}
              aria-hidden={position !== activeIndex}
            >
              {slide.link ? (
                <a className="partner-banners__link" href={slide.link}>
                  {content}
                </a>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
      <div className="partner-banners__dots" aria-hidden="true">
        {slides.map((slide, position) => (
          <button
            key={slide.id}
            type="button"
            tabIndex={-1}
            className={`partner-banners__dot${position === activeIndex ? ' is-active' : ''}`}
            onClick={() => setIndex(position)}
          />
        ))}
      </div>
    </div>
  );
}
