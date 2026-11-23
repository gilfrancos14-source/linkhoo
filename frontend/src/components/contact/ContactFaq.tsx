import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

interface ContactFaqItem {
  question: string;
  answer: string;
}

export default function ContactFaq() {
  const { t } = useTranslation();
  const faqs = t('contact.faq.items', { returnObjects: true }) as unknown as ContactFaqItem[];

  return (
    <div className="ct-card ct-faq">
      <div className="ct-card__head ct-card__head--compact">
        <span className="ct-faq__head-icon">
          <Icon name="shieldQuestion" size={12} />
        </span>
        <div>
          <h2 className="ct-faq__title">{t('contact.faq.title')}</h2>
          <p className="ct-faq__lead">{t('contact.faq.lead')}</p>
        </div>
      </div>

      <div className="ct-faq__list">
        {faqs.map((item) => (
          <details key={item.question} className="ct-faq__item">
            <summary>
              {item.question}
              <Icon name="chevronRight" size={12} className="ct-faq__chevron" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
