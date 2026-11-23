import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import Icon from '../landing/icons';
import { ABOUT_STAT_ICONS } from './data';

interface AboutStat {
  value: string;
  label: string;
  note: string;
}

export default function AboutStats() {
  const { t } = useTranslation();
  const stats = t('about.stats.items', { returnObjects: true }) as unknown as AboutStat[];

  return (
    <section className="ab-stats">
      <div className="ab-stats__inner">
        <div className="ab-section-intro">
          <span className="ab-badge">{t('about.stats.badge')}</span>
          <h2 className="ab-section-title">
            <Trans
              i18nKey="about.stats.title"
              components={{ brand: <span className="ab-text-brand" /> }}
            />
          </h2>
          <p className="ab-section-lead">{t('about.stats.lead')}</p>
          <Link to="/ci/inscription" className="ab-btn ab-btn--primary ab-btn--sm">
            {t('about.stats.join')}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <ul className="ab-stats__grid" role="list">
          {stats.map((stat, index) => (
            <li key={stat.label} className="ab-stat">
              <span className="ab-stat__icon">
                <Icon name={ABOUT_STAT_ICONS[index] ?? 'house'} size={20} />
              </span>
              <p className="ab-stat__value">{stat.value}</p>
              <p className="ab-stat__label">{stat.label}</p>
              <p className="ab-stat__note">{stat.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
