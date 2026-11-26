import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './partner-banners.css';

interface PartnerBannersProps {
  className?: string;
}

/** Espace publicitaire du hero : bannières partenaires en défilement automatique. */
export default function PartnerBanners({ className = '' }: PartnerBannersProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % 3);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`partner-banners ${className}`} aria-label={t('partnerAds.aria')}>
      <div className="partner-banners__slides">
        {[0, 1, 2].map((slide) => (
          <div
            key={slide}
            className={`partner-banners__slide partner-banners__slide--${slide}${
              slide === index ? ' is-active' : ''
            }`}
            aria-hidden={slide !== index}
          >
            <span className="partner-banners__label">{t('partnerAds.label')}</span>
            <strong>{t(`partnerAds.slide${slide + 1}`)}</strong>
            <span className="partner-banners__cta">{t('partnerAds.discover')}</span>
          </div>
        ))}
      </div>
      <div className="partner-banners__dots" aria-hidden="true">
        {[0, 1, 2].map((slide) => (
          <button
            key={slide}
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
