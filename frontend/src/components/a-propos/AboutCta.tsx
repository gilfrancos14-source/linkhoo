import { Link } from 'react-router-dom';
import Icon from '../landing/icons';

export default function AboutCta() {
  return (
    <section className="ab-cta">
      <div className="ab-cta__inner">
        <Icon name="house" size={56} className="ab-cta__icon" />
        <div className="ab-cta__body">
          <h2 className="ab-cta__title">Prêt à trouver votre prochain séjour ?</h2>
          <p className="ab-cta__text">
            Rejoignez des milliers de voyageurs et découvrez des logements uniques en Afrique de
            l&apos;Ouest.
          </p>
        </div>
        <Link to="/ci" className="ab-cta__btn">
          Explorer les annonces
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </section>
  );
}
