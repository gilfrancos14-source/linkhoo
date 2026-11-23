import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function ContactCta() {
  const { t } = useTranslation();

  return (
    <section className="ct-cta">
      <div className="ct-cta__inner">
        <Icon name="house" size={110} className="ct-cta__decor ct-cta__decor--large" />
        <Icon name="house" size={80} className="ct-cta__decor ct-cta__decor--small" />

        <div className="ct-cta__body">
          <span className="ct-cta__icon">
            <Icon name="send" size={22} />
          </span>
          <div>
            <h2>{t('contact.cta.title')}</h2>
            <p>{t('contact.cta.text')}</p>
          </div>
        </div>

        <a href="#contactForm" className="ct-cta__btn">
          {t('contact.cta.button')}
          <Icon name="arrowRight" size={14} />
        </a>
      </div>
    </section>
  );
}
