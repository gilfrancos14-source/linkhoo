import { useState, useRef, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { useMarket } from '../contexts/MarketContext';
import { useEspace } from '../hooks/useEspace';
import { apiNewsletter } from '../lib/api';
import { isValidEmail } from '../utils/validators';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

function AccountLinks({ market, homePath }: { market: string; homePath: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { resolve, loading } = useEspace();

  if (!isLoaded) {
    return (
      <>
        <li><Link to={`${homePath}/suivi-reservation`}>Suivre ma réservation</Link></li>
      </>
    );
  }

  if (isSignedIn) {
    return (
      <>
        <li>
          <button
            type="button"
            className="site-footer__link-btn"
            disabled={loading}
            onClick={() => void resolve()}
          >
            Mon espace
          </button>
        </li>
        <li><Link to={`${homePath}/suivi-reservation`}>Suivre ma réservation</Link></li>
      </>
    );
  }

  return (
    <>
      <li><Link to={`/${market.toLowerCase()}/login`}>Se connecter</Link></li>
      <li><Link to={`/${market.toLowerCase()}/inscription`}>S'inscrire</Link></li>
      <li><Link to={`${homePath}/suivi-reservation`}>Suivre ma réservation</Link></li>
    </>
  );
}

export default function Footer() {
  const homePath = useHomePath();
  const { market } = useMarket();
  const formRef = useRef<HTMLFormElement>(null);
  const [note, setNote] = useState('Nouveaux biens disponibles et offres de séjour, une fois par mois.');
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleNewsletter = async (e: FormEvent) => {
    e.preventDefault();
    const emailInput = formRef.current?.elements.namedItem('newsletter-email') as HTMLInputElement | null;
    const email = emailInput?.value.trim() ?? '';

    if (!email) {
      setEmailError('Veuillez entrer votre adresse email.');
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Adresse email invalide.');
      return;
    }

    setEmailError('');
    setSubmitError('');
    setSubmitting(true);
    try {
      await apiNewsletter.subscribe({ email, market });
      if (emailInput) emailInput.value = '';
      setNote('Merci ! Vous recevrez nos prochaines offres.');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link to={homePath} className="logo logo--light" aria-label="Linkhoo — retour à l'accueil">
              <img className="logo__mark logo__img" src="/logo.jpg" alt="Logo Linkhoo" width="64" height="64" loading="lazy" />
            </Link>
            <p className="site-footer__about">Des chambres d'hôtel pour vos escales, des appartements non meublés pour votre quotidien. Louez et séjournez en direct, sans intermédiaire.</p>
          </div>

          <nav className="site-footer__col" aria-label="Navigation pied de page">
            <h4 className="site-footer__title">Explorer</h4>
            <ul role="list">
              <li><a href={`${homePath}/#accueil`}>Accueil</a></li>
              <li><a href={`${homePath}/#categories`}>Appartements</a></li>
              <li><a href={`${homePath}/#evenements`}>Événements</a></li>
              <li><a href={`${homePath}/#tourisme`}>Tourisme</a></li>
            </ul>
          </nav>

          <nav className="site-footer__col" aria-label="Informations légales">
            <h4 className="site-footer__title">Informations</h4>
            <ul role="list">
              <li><Link to={`${homePath}/mentions-legales`}>Mentions légales</Link></li>
              <li><Link to={`${homePath}/politique-de-confidentialite`}>Politique de confidentialité</Link></li>
            </ul>
          </nav>

          <nav className="site-footer__col" aria-label="Compte">
            <h4 className="site-footer__title">Mon compte</h4>
            <ul role="list">
              {clerkConfigured ? (
                <AccountLinks market={market} homePath={homePath} />
              ) : (
                <>
                  <li><Link to={`/${market.toLowerCase()}/login`}>Se connecter</Link></li>
                  <li><Link to={`/${market.toLowerCase()}/inscription`}>S'inscrire</Link></li>
                  <li><Link to={`${homePath}/suivi-reservation`}>Suivre ma réservation</Link></li>
                </>
              )}
            </ul>
          </nav>

          <div className="site-footer__col">
            <h4 className="site-footer__title">Restons en contact</h4>
            <form ref={formRef} className="newsletter" id="newsletter-form" onSubmit={handleNewsletter} noValidate>
              <label className="sr-only" htmlFor="newsletter-email">Votre adresse email</label>
              <input
                className="newsletter__input"
                type="email"
                id="newsletter-email"
                name="newsletter-email"
                placeholder="votre@email.com"
                autoComplete="email"
                required
                disabled={submitting}
                aria-describedby={emailError || submitError ? 'newsletter-error' : undefined}
              />
              <button
                className="newsletter__btn"
                type="submit"
                disabled={submitting}
                aria-label={submitting ? 'Envoi en cours…' : "S'abonner à la newsletter"}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>
              </button>
            </form>
            {(emailError || submitError) && (
              <p className="newsletter__error" id="newsletter-error" role="alert" aria-live="assertive">
                {emailError || submitError}
              </p>
            )}
            <p className="newsletter__note" aria-live="polite">{note}</p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>&copy; 2026 Linkhoo — Tous droits réservés.</p>
          <p>Conçu avec soin pour des locataires et voyageurs exigeants.</p>
        </div>
      </div>
    </footer>
  );
}
