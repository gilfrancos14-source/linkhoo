import Icon from '../landing/icons';
import { ABOUT_BENEFITS } from './data';

export default function AboutWhy() {
  return (
    <section className="ab-why">
      <div className="ab-why__inner">
        <div className="ab-section-intro">
          <span className="ab-badge">Pourquoi choisir Linkhoo ?</span>
          <h2 className="ab-section-title">
            Une <span className="ab-text-brand">expérience unique</span>
          </h2>
          <p className="ab-section-lead">
            Nous ne sommes pas juste une plateforme de location.
            <br />
            Nous sommes votre allié pour des séjours réussis.
          </p>
        </div>

        <ul className="ab-benefits" role="list">
          {ABOUT_BENEFITS.map((benefit) => (
            <li key={benefit.title} className="ab-benefit">
              <span className={`ab-benefit__icon ab-benefit__icon--${benefit.tone}`}>
                <Icon name={benefit.icon} size={24} />
              </span>
              <h3 className="ab-benefit__title">{benefit.title}</h3>
              <p className="ab-benefit__text">{benefit.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
