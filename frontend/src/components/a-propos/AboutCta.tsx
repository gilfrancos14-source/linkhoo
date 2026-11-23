import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function AboutCta() {
  const { t } = useTranslation();

  return (
    <section className="ab-cta">
      <div className="ab-cta__inner">
        <Icon name="house" size={56} className="ab-cta__icon" />
        <div className="ab-cta__body">
          <h2 className="ab-cta__title">{t('about.cta.title')}</h2>
          <p className="ab-cta__text">{t('about.cta.text')}</p>
        </div>
        <Link to="/ci" className="ab-cta__btn">
          {t('about.cta.button')}
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </section>
  );
}
