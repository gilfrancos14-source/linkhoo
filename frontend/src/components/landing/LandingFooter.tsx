import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Icon from './icons';
import PWAControlPanel from '../PWAControlPanel';
import { useHomePath } from '../../hooks/useHomePath';
import { useMarket } from '../../contexts/MarketContext';
import { apiNewsletter } from '../../lib/api';
import { isValidEmail } from '../../utils/validators';
import { useTranslation } from 'react-i18next';



const SOCIALS = [
  { name: 'facebook' as const, label: 'Facebook' },
  { name: 'instagram' as const, label: 'Instagram' },
  { name: 'youtube' as const, label: 'YouTube' },
  { name: 'linkedin' as const, label: 'LinkedIn' },
  { name: 'music2' as const, label: 'TikTok' },
];

export default function LandingFooter() {
  const { t, i18n } = useTranslation();
  const homePath = useHomePath();
  const { market } = useMarket();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState(t('footer.newsletterNote'));
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // La note est un état local : on la resynchronise quand la langue change.
  useEffect(() => {
    setNote(t('footer.newsletterNote'));
  }, [i18n.language, t]);

  const handleNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();

    if (!value) {
      setEmailError(t('footer.newsletterEmailRequired'));
      return;
    }
    if (!isValidEmail(value)) {
      setEmailError(t('footer.newsletterEmailInvalid'));
      return;
    }

    setEmailError('');
    setSubmitError('');
    setSubmitting(true);
    try {
      await apiNewsletter.subscribe({ email: value, market });
      setEmail('');
      setNote(t('footer.newsletterSuccess'));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t('footer.newsletterError'),
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
              {t('footer.landing.platformDescription')}
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
            <h3>{t('footer.landing.mobileAppTitle')}</h3>
            <p className="acc-footer__text">
              {t('footer.landing.mobileAppDescription')}
            </p>
            <div className="acc-store">
              <span className="acc-store__btn">
                <Icon name="apple" size={14} />
                {t('footer.landing.appStore')}
              </span>
              <span className="acc-store__btn">
                <Icon name="play" size={12} className="acc-play" />
                {t('footer.landing.googlePlay')}
              </span>
            </div>
          </div>

          <div>
            <h3>{t('footer.landing.newsletterTitle')}</h3>
            <p className="acc-footer__text">
              {t('footer.landing.newsletterDescription')}
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
                placeholder={t('footer.newsletterPlaceholder')}
                aria-label={t('footer.newsletterLabel')}
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
                aria-label={t('footer.newsletterSubscribe')}
                disabled={submitting}
              >
                <Icon name="send" size={16} />
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
            <nav className="acc-footer__legal" aria-label={t('footer.aria.navigationFooter')}>
              <h3>{t('footer.landing.legalLinksTitle')}</h3>
              <ul className="acc-footer__list">
                <li>
                  <Link to="/a-propos">{t('footer.aboutLink')}</Link>
                </li>
                <li>
                  <Link to="/contact">{t('footer.contactLink')}</Link>
                </li>
                <li>{t('footer.terms')}</li>
                <li>
                  <Link to={`${homePath}/politique-de-confidentialite`}>
                    {t('footer.privacyLink')}
                  </Link>
                </li>
                <li>
                  <Link to={`${homePath}/mentions-legales`}>{t('footer.legalNotice')}</Link>
                </li>
                <li>{t('footer.landing.cookies')}</li>
              </ul>
            </nav>
          </div>

          <div>
            <h3>{t('footer.landing.accountTitle')}</h3>
            <ul className="acc-footer__list">
              <li>
                <Link to="/ci/login">{t('footer.login')}</Link>
              </li>
              <li>
                <Link to="/ci/inscription">{t('footer.signup')}</Link>
              </li>
              <li>
                <Link to="/ci/inscription/gerant">{t('footer.landing.becomeHost')}</Link>
              </li>
              <li>{t('footer.landing.help')}</li>
            </ul>
          </div>
        </div>

        <div className="acc-footer__bottom">
          <p className="acc-footer__copy">{t('footer.landing.copyright')}</p>
          <PWAControlPanel variant="inline" autoShow={false} />
        </div>
      </div>
    </footer>
  );
}
