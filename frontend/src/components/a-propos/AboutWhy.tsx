import { Trans, useTranslation } from 'react-i18next';
import Icon from '../landing/icons';
import { ABOUT_BENEFIT_STYLES } from './data';

interface AboutBenefit {
  title: string;
  text: string;
}

export default function AboutWhy() {
  const { t } = useTranslation();
  const benefits = t('about.why.benefits', { returnObjects: true }) as unknown as AboutBenefit[];

  return (
    <section className="ab-why">
      <div className="ab-why__inner">
        <div className="ab-section-intro">
          <span className="ab-badge">{t('about.why.badge')}</span>
          <h2 className="ab-section-title">
            <Trans
              i18nKey="about.why.title"
              components={{ brand: <span className="ab-text-brand" /> }}
            />
          </h2>
          <p className="ab-section-lead">
            {t('about.why.lead1')}
            <br />
            {t('about.why.lead2')}
          </p>
        </div>

        <ul className="ab-benefits" role="list">
          {benefits.map((benefit, index) => {
            const style = ABOUT_BENEFIT_STYLES[index] ?? { icon: 'house' as const, tone: 'brand' as const };
            return (
              <li key={benefit.title} className="ab-benefit">
                <span className={`ab-benefit__icon ab-benefit__icon--${style.tone}`}>
                  <Icon name={style.icon} size={24} />
                </span>
                <h3 className="ab-benefit__title">{benefit.title}</h3>
                <p className="ab-benefit__text">{benefit.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
