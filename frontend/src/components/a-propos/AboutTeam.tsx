import Icon from '../landing/icons';
import { ABOUT_TEAM_VALUES } from './data';

export default function AboutTeam() {
  return (
    <section className="ab-team">
      <div className="ab-team__inner">
        <div className="ab-team__content">
          <span className="ab-badge">Notre équipe</span>
          <h2 className="ab-section-title">
            Des passionnés derrière <span className="ab-text-brand">Linkhoo</span>
          </h2>
          <p className="ab-section-lead">
            Nous sommes une équipe de jeunes professionnels, unis par une même ambition : faire de
            la location directe une réalité accessible à tous en Afrique de l&apos;Ouest.
          </p>

          <ul className="ab-team__values" role="list">
            {ABOUT_TEAM_VALUES.map((value) => (
              <li key={value.title}>
                <span className="ab-team__icon">
                  <Icon name={value.icon} size={20} />
                </span>
                <p className="ab-team__value-title">{value.title}</p>
                <p className="ab-team__value-text">{value.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="ab-team__visual">
          <p className="ab-hand ab-team__hand">
            Ensemble pour
            <br />
            l&apos;Afrique de l&apos;Ouest
            <br />
            plus connectée
          </p>
        </div>
      </div>
    </section>
  );
}
