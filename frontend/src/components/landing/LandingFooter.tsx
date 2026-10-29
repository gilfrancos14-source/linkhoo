import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Icon from './icons';
import { useHomePath } from '../../hooks/useHomePath';
import { useMarket } from '../../contexts/MarketContext';
import { apiNewsletter } from '../../lib/api';
import { isValidEmail } from '../../utils/validators';

const DEFAULT_NOTE =
  'Nouveaux biens disponibles et offres de séjour, une fois par mois.';

const SOCIALS = [
  { name: 'facebook' as const, label: 'Facebook' },
  { name: 'instagram' as const, label: 'Instagram' },
  { name: 'youtube' as const, label: 'YouTube' },
  { name: 'linkedin' as const, label: 'LinkedIn' },
  { name: 'music2' as const, label: 'TikTok' },
];

export default function LandingFooter() {
  const homePath = useHomePath();
  const { market } = useMarket();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();

    if (!value) {
      setEmailError('Veuillez entrer votre adresse email.');
      return;
    }
    if (!isValidEmail(value)) {
      setEmailError('Adresse email invalide.');
      return;
    }

    setEmailError('');
    setSubmitError('');
    setSubmitting(true);
    try {
      await apiNewsletter.subscribe({ email: value, market });
      setEmail('');
      setNote('Merci ! Vous recevrez nos prochaines offres.');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            <form
              id="newsletter-form"
              className="acc-newsletter"
              onSubmit={handleNewsletter}
              noValidate
            >
              <input
                id="newsletter-email"
                name="newsletter-email"
                type="email"
                placeholder="Votre adresse e-mail"
                aria-label="Votre adresse e-mail"
                aria-describedby={
                  emailError || submitError ? 'newsletter-error' : undefined
                }
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError('');
                }}
              />
              <button
                type="submit"
                aria-label="S'abonner à la newsletter"
                disabled={submitting}
              >
                <Icon name="send" size={12} />
              </button>
            </form>
            {(emailError || submitError) && (
              <p className="newsletter__error" id="newsletter-error" role="alert">
                {emailError || submitError}
              </p>
            )}
            <p className="newsletter__note" aria-live="polite">
              {note}
            </p>
          </div>

          <div>
            <nav className="acc-footer__legal" aria-label="Informations légales">
              <h3>Liens légaux</h3>
              <ul className="acc-footer__list">
                <li>
                  <Link to="/a-propos">À propos</Link>
                </li>
                <li>
                  <Link to="/contact">Contact</Link>
                </li>
                <li>Conditions d&apos;utilisation</li>
                <li>
                  <Link to={`${homePath}/politique-de-confidentialite`}>
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link to={`${homePath}/mentions-legales`}>Mentions légales</Link>
                </li>
                <li>Cookies</li>
              </ul>
            </nav>
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
