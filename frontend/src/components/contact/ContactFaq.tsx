import Icon from '../landing/icons';
import { CONTACT_FAQS } from './data';

export default function ContactFaq() {
  return (
    <div className="ct-card ct-faq">
      <div className="ct-card__head ct-card__head--compact">
        <span className="ct-faq__head-icon">
          <Icon name="shieldQuestion" size={12} />
        </span>
        <div>
          <h2 className="ct-faq__title">Questions fréquentes</h2>
          <p className="ct-faq__lead">
            Vous avez une question ? Voici les réponses aux questions les plus courantes.
          </p>
        </div>
      </div>

      <div className="ct-faq__list">
        {CONTACT_FAQS.map((item) => (
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
