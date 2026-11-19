import { useState, useRef, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { useMarket } from '../contexts/MarketContext';
import { useEspace } from '../hooks/useEspace';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';
import { useOfflineQueueSync } from '../hooks/useOfflineQueueSync';
import { apiNewsletter } from '../lib/api';
import { PRESS_ITEMS } from '../data/press';
import PWAControlPanel from './PWAControlPanel';
import { enqueue } from '../lib/offlineQueue';
import { isValidEmail } from '../utils/validators';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

function AccountLinks({ market, homePath }: { market: string; homePath: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { resolve, loading } = useEspace();
  const { t } = useTranslation();

  if (!isLoaded) {
    return (
      <>
        <li><Link to={`${homePath}/suivi-reservation`}>{t('footer.trackReservation')}</Link></li>
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
            {t('footer.mySpace')}
          </button>
        </li>
        <li><Link to={`${homePath}/suivi-reservation`}>{t('footer.trackReservation')}</Link></li>
      </>
    );
  }

  return (
    <>
      <li><Link to={`/${market.toLowerCase()}/login`}>{t('footer.login')}</Link></li>
      <li><Link to={`/${market.toLowerCase()}/inscription`}>{t('footer.signup')}</Link></li>
      <li><Link to={`${homePath}/suivi-reservation`}>{t('footer.trackReservation')}</Link></li>
    </>
  );
}

export default function Footer() {
  const { t } = useTranslation();
  const homePath = useHomePath();
  const { market } = useMarket();
  const formRef = useRef<HTMLFormElement>(null);
  const [note, setNote] = useState(t('footer.newsletterNote'));
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
      setEmailError(t('footer.newsletterEmailRequired'));
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError(t('footer.newsletterEmailInvalid'));
      return;
    }

    setEmailError('');
    setSubmitError('');

    // Hors-ligne : l'inscription est mise en file d'attente et partira
    // automatiquement au retour de la connexion.
    if (!online) {
      enqueue({ type: 'newsletter', payload: { email, market } });
      if (emailInput) emailInput.value = '';
      setNote(t('footer.newsletterQueued'));
      return;
    }

    setSubmitting(true);
    try {
      await apiNewsletter.subscribe({ email, market });
      if (emailInput) emailInput.value = '';
      setNote(t('footer.newsletterSuccess'));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('footer.newsletterError'));
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
            <Link to={homePath} className="logo logo--light" aria-label={t('footer.aria.logo')}>
              <img className="logo__mark logo__img" src="/logo.jpg" alt={t('footer.logo.alt')} width="64" height="64" loading="lazy" />
            </Link>
            <p className="site-footer__about">{t('footer.aboutText')}</p>
            <p className="site-footer__email">
              <strong>{t('footer.email')}</strong>{' '}
              <a href={`mailto:${t('footer.contact.email')}`}>{t('footer.contact.email')}</a>
            </p>
            <ul className="site-footer__social" role="list" aria-label={t('footer.aria.socialMedia')}>
              <li>
                <a href={t('footer.social.facebook')} target="_blank" rel="noopener noreferrer" aria-label={t('footer.aria.facebook')}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13 22v-8h3l1-4h-4V8c0-1.1.4-2 2-2h2V2.1S16.2 2 14.4 2C11 2 9 4 9 7.4V10H6v4h3v8z"/></svg>
                </a>
              </li>
              <li>
                <a href={t('footer.social.x')} target="_blank" rel="noopener noreferrer" aria-label={t('footer.aria.x')}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3l-6.6 7.5L22 21h-6l-4.7-6.1L5.8 21H3l7.1-8.1L2 3h6.2l4.2 5.6z"/></svg>
                </a>
              </li>
              <li>
                <a href={t('footer.social.linkedin')} target="_blank" rel="noopener noreferrer" aria-label={t('footer.aria.linkedin')}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M6.9 8.5H3.6V21h3.3zM5.2 3a1.9 1.9 0 100 3.8 1.9 1.9 0 000-3.8zM21 13.4c0-3.2-1.7-4.7-4-4.7-1.8 0-2.6 1-3.1 1.7V8.5H10.6V21H14v-6.7c0-1.4.7-2.3 1.9-2.3s1.9.8 1.9 2.3V21H21z"/></svg>
                </a>
              </li>
              <li>
                <a href={t('footer.social.instagram')} target="_blank" rel="noopener noreferrer" aria-label={t('footer.aria.instagram')}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2m0 4.9A4.9 4.9 0 1016.9 12 4.9 4.9 0 0012 7.1m0 8.1A3.2 3.2 0 1115.2 12 3.2 3.2 0 0112 15.2m5.1-9.4a1.1 1.1 0 11-1.1-1.1 1.1 1.1 0 011.1 1.1"/></svg>
                </a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__title">{t('footer.pressTitle')}</h4>
            <ul className="site-footer__press" role="list">
              {PRESS_ITEMS.map((item) => (
                <li key={item.id} className="site-footer__press-item">
                  <span className="site-footer__press-title">{t(`footer.press.${item.id}.title`)}</span>
                  <span className="site-footer__press-meta">
                    {t(`footer.press.${item.id}.date`)} / {t(`footer.press.${item.id}.source`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__title">{t('footer.downloadApp')}</h4>
            <p className="site-footer__about">
              {t('footer.downloadAppText')}
            </p>
            <span className="site-footer__store">{t('footer.comingSoon')}</span>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__title">{t('footer.newsletter')}</h4>
            <form ref={formRef} className="newsletter" id="newsletter-form" onSubmit={handleNewsletter} noValidate>
              <label className="sr-only" htmlFor="newsletter-email">{t('footer.newsletterLabel')}</label>
              <input
                className="newsletter__input"
                type="email"
                id="newsletter-email"
                name="newsletter-email"
                placeholder={t('footer.newsletterPlaceholder')}
                autoComplete="email"
                required
                disabled={submitting}
                aria-describedby={emailError || submitError ? 'newsletter-error' : undefined}
              />
              <button
                className="newsletter__btn"
                type="submit"
                disabled={submitting}
                aria-label={submitting ? t('footer.newsletterSending') : t('footer.newsletterSubscribe')}
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
          <p className="site-footer__copyright">{t('footer.copyright')}</p>
          <nav className="site-footer__legal" aria-label={t('footer.legal')}>
            <ul role="list">
              <li><Link to="/a-propos">{t('footer.aboutLink')}</Link></li>
              <li><Link to="/contact">{t('footer.contactLink')}</Link></li>
              <li><Link to={`${homePath}/mentions-legales`}>{t('footer.legalNotice')}</Link></li>
              <li><Link to={`${homePath}/politique-de-confidentialite`}>{t('footer.privacyLink')}</Link></li>
            </ul>
          </nav>
          <nav className="site-footer__account" aria-label={t('footer.account')}>
            <ul role="list">
              {clerkConfigured ? (
                <AccountLinks market={market} homePath={homePath} />
              ) : (
                <>
                  <li><Link to={`/${market.toLowerCase()}/login`}>{t('footer.login')}</Link></li>
                  <li><Link to={`/${market.toLowerCase()}/inscription`}>{t('footer.signup')}</Link></li>
                  <li><Link to={`${homePath}/suivi-reservation`}>{t('footer.trackReservation')}</Link></li>
                </>
              )}
            </ul>
          </nav>
          <PWAControlPanel variant="inline" autoShow={false} />
        </div>
      </div>
    </footer>
  );
}
