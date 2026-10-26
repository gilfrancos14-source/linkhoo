import { Link } from 'react-router-dom';
import Icon from './icons';

const SOCIALS = [
  { name: 'facebook' as const, label: 'Facebook' },
  { name: 'instagram' as const, label: 'Instagram' },
  { name: 'youtube' as const, label: 'YouTube' },
  { name: 'linkedin' as const, label: 'LinkedIn' },
  { name: 'music2' as const, label: 'TikTok' },
];

export default function LandingFooter() {
  return (
    <footer className="acc-footer">
      <div className="acc-container acc-footer__inner">
        <div className="acc-footer__grid">
          <div className="acc-footer__brand">
            <div className="acc-footer__logo">
              <span className="acc-footer__mark">
                <Icon name="house" size={20} />
              </span>
              <span className="acc-footer__name">Linkhoo</span>
            </div>
            <p className="acc-footer__desc">
              Linkhoo est la plateforme de location directe en Afrique de l&apos;Ouest. Des milliers
              de logements pour tous vos séjours.
            </p>
            <div className="acc-footer__socials">
              {SOCIALS.map((social) => (
                <span key={social.label} aria-label={social.label} role="img">
                  <Icon name={social.name} size={18} />
                </span>
              ))}
              <span className="acc-footer__x" aria-label="X" role="img">
                𝕏
              </span>
            </div>
          </div>

          <div>
            <h3>Application mobile</h3>
            <p className="acc-footer__text">
              Téléchargez notre application pour une meilleure expérience.
            </p>
            <div className="acc-store">
              <span className="acc-store__btn">
                <Icon name="apple" size={14} />
                App Store
              </span>
              <span className="acc-store__btn">
                <Icon name="play" size={12} className="acc-play" />
                Google Play
              </span>
            </div>
          </div>

          <div>
            <h3>Newsletter</h3>
            <p className="acc-footer__text">
              Restez informé de nos nouveautés et offres exclusives.
            </p>
            <form className="acc-newsletter" onSubmit={(event) => event.preventDefault()}>
              <input type="email" placeholder="Votre adresse e-mail" aria-label="Votre adresse e-mail" />
              <button type="submit" aria-label="Envoyer">
                <Icon name="send" size={12} />
              </button>
            </form>
          </div>

          <div>
            <h3>Liens légaux</h3>
            <ul className="acc-footer__list">
              <li>Conditions d&apos;utilisation</li>
              <li>
                <Link to="/politique-de-confidentialite">Politique de confidentialité</Link>
              </li>
              <li>
                <Link to="/mentions-legales">Mentions légales</Link>
              </li>
              <li>Cookies</li>
            </ul>
          </div>

          <div>
            <h3>Compte</h3>
            <ul className="acc-footer__list">
              <li>
                <Link to="/ci/login">Se connecter</Link>
              </li>
              <li>
                <Link to="/ci/inscription">S&apos;inscrire</Link>
              </li>
              <li>
                <Link to="/ci/inscription/gerant">Devenir hôte</Link>
              </li>
              <li>Aide</li>
            </ul>
          </div>
        </div>

        <p className="acc-footer__copy">© 2025 Linkhoo. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
