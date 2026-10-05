import { useState, useRef, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { useMarket } from '../contexts/MarketContext';
import { useEspace } from '../hooks/useEspace';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineQueueSync } from '../hooks/useOfflineQueueSync';
import { apiNewsletter } from '../lib/api';
import { PRESS_ITEMS } from '../data/press';
import { enqueue } from '../lib/offlineQueue';
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
  const online = useOnlineStatus();
  useOfflineQueueSync();

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

    // Hors-ligne : l'inscription est mise en file d'attente et partira
    // automatiquement au retour de la connexion.
    if (!online) {
      enqueue({ type: 'newsletter', payload: { email, market } });
      if (emailInput) emailInput.value = '';
      setNote('Inscription enregistrée : elle sera envoyée au retour de la connexion.');
      return;
    }

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
        {/* Grille 4 colonnes, squelette CoinAfrique. */}
        <div className="site-footer__grid site-footer__grid--4">
          <div className="site-footer__col site-footer__brand">
            <Link to={homePath} className="logo logo--light" aria-label="Linkhoo — retour à l'accueil">
              <img className="logo__mark logo__img" src="/logo.jpg" alt="Logo Linkhoo" width="64" height="64" loading="lazy" />
            </Link>
            <p className="site-footer__about">Des chambres d'hôtel pour vos escales, des appartements non meublés pour votre quotidien. Louez et séjournez en direct, sans intermédiaire.</p>
            <p className="site-footer__email">
              <strong>Email :</strong>{' '}
              <a href="mailto:contact@linkhoo.com">contact@linkhoo.com</a>
            </p>
            <ul className="site-footer__social" role="list" aria-label="Réseaux sociaux">
              <li>
                <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Linkhoo sur Facebook">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13 22v-8h3l1-4h-4V8c0-1.1.4-2 2-2h2V2.1S16.2 2 14.4 2C11 2 9 4 9 7.4V10H6v4h3v8z"/></svg>
                </a>
              </li>
              <li>
                <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="Linkhoo sur X">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3l-6.6 7.5L22 21h-6l-4.7-6.1L5.8 21H3l7.1-8.1L2 3h6.2l4.2 5.6z"/></svg>
                </a>
              </li>
              <li>
                <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="Linkhoo sur LinkedIn">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M6.9 8.5H3.6V21h3.3zM5.2 3a1.9 1.9 0 100 3.8 1.9 1.9 0 000-3.8zM21 13.4c0-3.2-1.7-4.7-4-4.7-1.8 0-2.6 1-3.1 1.7V8.5H10.6V21H14v-6.7c0-1.4.7-2.3 1.9-2.3s1.9.8 1.9 2.3V21H21z"/></svg>
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Linkhoo sur Instagram">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2m0 4.9A4.9 4.9 0 1016.9 12 4.9 4.9 0 0012 7.1m0 8.1A3.2 3.2 0 1115.2 12 3.2 3.2 0 0112 15.2m5.1-9.4a1.1 1.1 0 11-1.1-1.1 1.1 1.1 0 011.1 1.1"/></svg>
                </a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__title">On parle de nous</h4>
            <ul className="site-footer__press" role="list">
              {PRESS_ITEMS.map((item) => (
                <li key={item.id} className="site-footer__press-item">
                  <span className="site-footer__press-title">{item.titre}</span>
                  <span className="site-footer__press-meta">
                    {item.date} / {item.source}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__title">Télécharger l’application</h4>
            <p className="site-footer__about">
              Louez, réservez et échangez en direct. Notre application mobile arrive bientôt.
            </p>
            <span className="site-footer__store">Bientôt disponible sur Google Play</span>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__title">Inscription newsletter</h4>
            <form ref={formRef} className="newsletter" id="newsletter-form" onSubmit={handleNewsletter} noValidate>
              <label className="sr-only" htmlFor="newsletter-email">Votre adresse email</label>
              <input
                className="newsletter__input"
                type="email"
                id="newsletter-email"
                name="newsletter-email"
                placeholder="Votre adresse électronique"
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
            <p className="newsletter__note" aria-live="polite">
              {note}
            </p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">Copyright © Linkhoo 2026</p>
          <nav className="site-footer__legal" aria-label="Informations légales">
            <ul role="list">
              <li><Link to="/a-propos">À propos</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to={`${homePath}/mentions-legales`}>Mentions légales</Link></li>
              <li><Link to={`${homePath}/politique-de-confidentialite`}>Politique de confidentialité</Link></li>
            </ul>
          </nav>
          <nav className="site-footer__account" aria-label="Compte">
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
        </div>
      </div>
    </footer>
  );
}
