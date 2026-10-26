import { Link } from 'react-router-dom';
import Icon from '../landing/icons';
import { ABOUT_STATS } from './data';

export default function AboutStats() {
  return (
    <section className="ab-stats">
      <div className="ab-stats__inner">
        <div className="ab-section-intro">
          <span className="ab-badge">En quelques chiffres</span>
          <h2 className="ab-section-title">
            Une plateforme qui <span className="ab-text-brand">grandit avec vous</span>
          </h2>
          <p className="ab-section-lead">
            Depuis notre lancement, nous accompagnons des milliers de voyageurs et de propriétaires
            à travers l&apos;Afrique de l&apos;Ouest.
          </p>
          <Link to="/ci/inscription" className="ab-btn ab-btn--primary ab-btn--sm">
            Nous rejoindre
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <ul className="ab-stats__grid" role="list">
          {ABOUT_STATS.map((stat) => (
            <li key={stat.label} className="ab-stat">
              <span className="ab-stat__icon">
                <Icon name={stat.icon} size={20} />
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
