import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function AboutHero() {
  const { t } = useTranslation();

  return (
    <section className="ab-hero">
      <div className="ab-hero__inner">
        <div className="ab-hero__content">
          <nav className="ab-breadcrumb" aria-label={t('about.nav.breadcrumb')}>
            <Icon name="house" size={14} />
            <Link to="/">{t('navigation.home')}</Link>
            <Icon name="chevronRight" size={12} />
            <span>{t('navigation.about')}</span>
          </nav>

          <span className="ab-badge">{t('about.hero.badge')}</span>

          <h1 className="ab-hero__title">
            <Trans
              i18nKey="about.hero.title"
              components={{
                br: <br />,
                brand: <span className="ab-hero__title-brand" />,
                grad: <span className="ab-hero__title-gradient" />,
                dot: <span className="ab-hero__title-dot" />,
              }}
            />
          </h1>

          <p className="ab-hero__lead">
            <span>{t('about.hero.lead1')}</span>
            <br />
            {t('about.hero.lead2')}
          </p>

          <Link to="/#ou-louer" className="ab-btn ab-btn--primary ab-hero__cta">
            {t('about.hero.cta')}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <div className="ab-hero__visual">
          <span className="ab-hero__blob ab-hero__blob--pill" aria-hidden="true" />
          <span className="ab-hero__blob ab-hero__blob--dot" aria-hidden="true" />

          <div className="ab-hero__photo">
            <p className="ab-hand ab-hero__hand">
              <Trans i18nKey="about.hero.hand" components={{ br: <br /> }} />
              <svg
                className="ab-hero__underline"
                width="90"
                height="10"
                viewBox="0 0 90 10"
                aria-hidden="true"
              >
                <path
                  d="M2 8 Q40 0 88 3"
                  stroke="#fff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </p>

            <div className="ab-hero__badge">
              <span className="ab-hero__badge-icon">
                <Icon name="house" size={24} />
              </span>
              <div>
                <p className="ab-hero__badge-value">{t('about.hero.statValue')}</p>
                <p className="ab-hero__badge-label">{t('about.hero.statLabel')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
