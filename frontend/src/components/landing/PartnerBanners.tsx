import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PARTNER_ADS } from './partnerAds';
import './partner-banners.css';

interface PartnerBannersProps {
  className?: string;
}

/** Espace publicitaire du hero : visuels (images ou GIF animés) en défilement automatique. */
export default function PartnerBanners({ className = '' }: PartnerBannersProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % PARTNER_ADS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`partner-banners ${className}`} aria-label={t('partnerAds.aria')}>
      <div className="partner-banners__slides">
        {PARTNER_ADS.map((ad, slide) => {
          const caption = t(ad.textKey);
          const content = (
            <>
              {/* Repli texte : visible si le visuel est absent ou ne charge pas. */}
              <div className={`partner-banners__fallback partner-banners__slide--${slide}`}>
                <span className="partner-banners__label">{t('partnerAds.label')}</span>
                <strong>{caption}</strong>
                <span className="partner-banners__cta">{t('partnerAds.discover')}</span>
              </div>
              {ad.image && (
                <img
                  className={`partner-banners__img${loaded[slide] ? ' is-loaded' : ''}`}
                  src={ad.image}
                  alt={t('partnerAds.imageAlt', { name: caption })}
                  decoding="async"
                  onLoad={() => setLoaded((current) => ({ ...current, [slide]: true }))}
                  onError={() => setLoaded((current) => ({ ...current, [slide]: false }))}
                />
              )}
            </>
          );

          return (
            <div
              key={ad.textKey}
              className={`partner-banners__slide${slide === index ? ' is-active' : ''}`}
              aria-hidden={slide !== index}
            >
              {ad.href ? (
                <a className="partner-banners__link" href={ad.href}>
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
        {PARTNER_ADS.map((ad, slide) => (
          <button
            key={ad.textKey}
            type="button"
            tabIndex={-1}
            className={`partner-banners__dot${slide === index ? ' is-active' : ''}`}
            onClick={() => setIndex(slide)}
          />
        ))}
      </div>
    </div>
  );
}
