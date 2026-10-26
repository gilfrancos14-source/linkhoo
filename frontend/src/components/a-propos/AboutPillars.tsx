import Icon from '../landing/icons';
import { ABOUT_VALUES } from './data';

export default function AboutPillars() {
  return (
    <section className="ab-pillars">
      <div className="ab-pillars__inner">
        <div className="ab-pillar">
          <span className="ab-pillar__icon">
            <Icon name="target" size={28} />
          </span>
          <h2 className="ab-pillar__title">Notre mission</h2>
          <p className="ab-pillar__text">
            Simplifier l&apos;accès à la location de logements et d&apos;hébergements en Afrique de
            l&apos;Ouest en offrant une plateforme fiable, intuitive et accessible à tous.
          </p>
        </div>

        <div className="ab-pillar">
          <span className="ab-pillar__icon">
            <Icon name="eye" size={28} />
          </span>
          <h2 className="ab-pillar__title">Notre vision</h2>
          <p className="ab-pillar__text">
            Devenir la référence de la location directe en Afrique de l&apos;Ouest, en connectant
            des millions de personnes à des logements de qualité, partout et à tout moment.
          </p>
        </div>

        <div className="ab-pillar">
          <span className="ab-pillar__icon">
            <Icon name="gem" size={28} />
          </span>
          <h2 className="ab-pillar__title">Nos valeurs</h2>
          <ul className="ab-pillar__values">
            {ABOUT_VALUES.map((value) => (
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
