import { Link } from 'react-router-dom';
import Icon from '../landing/icons';

const SOCIALS = [
  { name: 'facebook' as const, label: 'Facebook' },
  { name: 'twitter' as const, label: 'X' },
  { name: 'instagram' as const, label: 'Instagram' },
  { name: 'youtube' as const, label: 'YouTube' },
  { name: 'linkedin' as const, label: 'LinkedIn' },
  { name: 'music2' as const, label: 'TikTok' },
];

export default function AboutFooter() {
  return (
    <footer className="ab-footer">
      <div className="ab-footer__inner">
        <div className="ab-footer__grid">
          <div className="ab-footer__brand">
            <Link to="/" className="ab-footer__logo">
              <Icon name="house" size={26} />
              <span>Linkhoo</span>
            </Link>
            <p className="ab-footer__desc">
              La location directe en Afrique de l&apos;Ouest.
              <br />
              Des milliers de logements, une seule plateforme.
            </p>
            <div className="ab-footer__socials">
              {SOCIALS.map((social) => (
                <span key={social.label} aria-label={social.label} role="img">
                  <Icon name={social.name} size={16} />
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3>Liens utiles</h3>
            <ul className="ab-footer__list">
              <li>
                <Link to="/">Accueil</Link>
              </li>
              <li>
                <Link to="/a-propos">À propos</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
              <li>
                <Link to="/contact">FAQ</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3>Nos marchés</h3>
            <ul className="ab-footer__list">
              <li>
                <Link to="/sn">Sénégal</Link>
              </li>
              <li>
                <Link to="/ci">Côte d&apos;Ivoire</Link>
              </li>
              <li>
                <Link to="/bj">Bénin</Link>
              </li>
              <li>
                <Link to="/ml">Mali</Link>
              </li>
              <li>et 7 autres pays</li>
            </ul>
          </div>

          <div>
            <h3>Application mobile</h3>
            <p className="ab-footer__text">
              Téléchargez notre application
              <br />
              pour une meilleure expérience.
            </p>
            <div className="ab-footer__stores">
              <span className="ab-store">
                <Icon name="apple" size={18} />
                <span>
                  <small>Disponible sur</small>
                  App Store
                </span>
              </span>
              <span className="ab-store">
                <Icon name="play" size={14} className="ab-store__play" />
                <span>
                  <small>Disponible sur</small>
                  Google Play
                </span>
              </span>
            </div>
          </div>

          <div>
            <h3>Newsletter</h3>
            <p className="ab-footer__text">
              Restez informé de nos nouveautés
              <br />
              et offres exclusives.
            </p>
            <form className="ab-newsletter" onSubmit={(event) => event.preventDefault()}>
              <input type="email" placeholder="Votre adresse e-mail" aria-label="Votre adresse e-mail" />
              <button type="submit" aria-label="Envoyer">
                <Icon name="send" size={16} />
              </button>
            </form>
          </div>
        </div>

        <div className="ab-footer__bottom">
          <p>© 2025 Linkhoo. Tous droits réservés.</p>
          <ul className="ab-footer__legal">
            <li>
              <Link to="/ci/mentions-legales">Mentions légales</Link>
            </li>
            <li>
              <Link to="/ci/mentions-legales">Conditions d&apos;utilisation</Link>
            </li>
            <li>
              <Link to="/ci/politique-de-confidentialite">Politique de confidentialité</Link>
            </li>
            <li>
              <Link to="/contact">Aide</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
