import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './icons';
import { SLIDES } from './data';

export default function LandingSlider() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [index]);

  const go = (next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  };

  return (
    <section className="acc-slider" aria-roledescription="carrousel" aria-label={t('landing.slider.ariaLabel')}>
      <div className="acc-slider__bg" style={{ background: SLIDES[index] }} aria-hidden="true" />
      <div className="acc-container acc-slider__inner">
        <div className="acc-slider__content">
          <p className="acc-slider__eyebrow">{t('landing.slider.eyebrow')}</p>
          <h2 className="acc-slider__title">{t('landing.slider.title')}</h2>
          <p className="acc-slider__desc">
            {t('landing.slider.desc')}
          </p>
          <button type="button" className="acc-slider__cta">
            {t('landing.slider.cta')}
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="acc-slider__nav acc-slider__nav--prev"
        aria-label={t('landing.slider.prev')}
        onClick={() => go(index - 1)}
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <button
        type="button"
        className="acc-slider__nav acc-slider__nav--next"
        aria-label={t('landing.slider.next')}
        onClick={() => go(index + 1)}
      >
        <Icon name="chevronRight" size={20} />
      </button>

      <div className="acc-slider__dots">
        {SLIDES.map((_, slide) => (
          <button
            key={slide}
            type="button"
            className={`acc-slider__dot${slide === index ? ' acc-slider__dot--active' : ''}`}
            aria-label={t('landing.slider.slide', { index: slide + 1 })}
            aria-current={slide === index}
            onClick={() => go(slide)}
          />
        ))}
      </div>
    </section>
  );
}
