import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function AboutPillars() {
  const { t } = useTranslation();
  const values = t('about.pillars.values', { returnObjects: true }) as unknown as string[];

  return (
    <section className="ab-pillars">
      <div className="ab-pillars__inner">
        <div className="ab-pillar">
          <span className="ab-pillar__icon">
            <Icon name="target" size={28} />
          </span>
          <h2 className="ab-pillar__title">{t('about.pillars.missionTitle')}</h2>
          <p className="ab-pillar__text">{t('about.pillars.missionText')}</p>
        </div>

        <div className="ab-pillar">
          <span className="ab-pillar__icon">
            <Icon name="eye" size={28} />
          </span>
          <h2 className="ab-pillar__title">{t('about.pillars.visionTitle')}</h2>
          <p className="ab-pillar__text">{t('about.pillars.visionText')}</p>
        </div>

        <div className="ab-pillar">
          <span className="ab-pillar__icon">
            <Icon name="gem" size={28} />
          </span>
          <h2 className="ab-pillar__title">{t('about.pillars.valuesTitle')}</h2>
          <ul className="ab-pillar__values">
            {values.map((value) => (
              <li key={value}>
                <Icon name="check" size={16} />
                {value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
