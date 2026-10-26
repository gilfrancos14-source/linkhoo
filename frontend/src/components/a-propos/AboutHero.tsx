import { Link } from 'react-router-dom';
import Icon from '../landing/icons';

export default function AboutHero() {
  return (
    <section className="ab-hero">
      <div className="ab-hero__inner">
        <div className="ab-hero__content">
          <nav className="ab-breadcrumb" aria-label="Fil d'Ariane">
            <Icon name="house" size={14} />
            <Link to="/">Accueil</Link>
            <Icon name="chevronRight" size={12} />
            <span>À propos</span>
          </nav>

          <span className="ab-badge">À propos de Linkhoo</span>

          <h1 className="ab-hero__title">
            Notre mission :{' '}
            <br />
            rendre la location <span className="ab-hero__title-brand">plus simple,</span>
            {' '}
            <br />
            <span className="ab-hero__title-gradient">plus sûre</span> et{' '}
            <span className="ab-hero__title-gradient">plus proche</span> de vous
            <span className="ab-hero__title-dot">.</span>
          </h1>

          <p className="ab-hero__lead">
            <span>
              Linkhoo est une plateforme de location directe qui connecte les voyageurs aux
              propriétaires, partout en Afrique de l&apos;Ouest.
            </span>
            <br />
            Nous croyons qu&apos;un bon séjour commence par une bonne expérience de recherche.
            C&apos;est pourquoi nous mettons la technologie au service de l&apos;hospitalité et de la
            confiance.
          </p>

          <Link to="/#ou-louer" className="ab-btn ab-btn--primary ab-hero__cta">
            Découvrir nos marchés
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <div className="ab-hero__visual">
          <span className="ab-hero__blob ab-hero__blob--pill" aria-hidden="true" />
          <span className="ab-hero__blob ab-hero__blob--dot" aria-hidden="true" />

          <div className="ab-hero__photo">
            <p className="ab-hand ab-hero__hand">
              Des séjours
              <br />
              qui rapprochent
              <br />
              les gens
              <svg
                className="ab-hero__underline"
                width="90"
                height="10"
                viewBox="0 0 90 10"
                aria-hidden="true"
              >
                <path
                  d="M2 8 Q40 0 88 3"
                  stroke="#fff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </p>

            <div className="ab-hero__badge">
              <span className="ab-hero__badge-icon">
                <Icon name="house" size={24} />
              </span>
              <div>
                <p className="ab-hero__badge-value">12 pays</p>
                <p className="ab-hero__badge-label">en Afrique de l&apos;Ouest</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
