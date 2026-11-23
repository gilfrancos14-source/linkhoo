import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
              <Trans i18nKey="about.footer.desc" components={{ br: <br /> }} />
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
            <h3>{t('about.footer.usefulLinks')}</h3>
            <ul className="ab-footer__list">
              <li><Link to="/">{t('navigation.home')}</Link></li>
              <li><Link to="/a-propos">{t('navigation.about')}</Link></li>
              <li><Link to="/contact">{t('navigation.contact')}</Link></li>
              <li><Link to="/contact">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3>{t('about.footer.markets')}</h3>
            <ul className="ab-footer__list">
              <li><Link to="/sn">{t('about.footer.countries.senegal')}</Link></li>
              <li><Link to="/ci">{t('about.footer.countries.ivoryCoast')}</Link></li>
              <li><Link to="/bj">{t('about.footer.countries.benin')}</Link></li>
              <li><Link to="/ml">{t('about.footer.countries.mali')}</Link></li>
              <li>{t('about.footer.moreCountries')}</li>
            </ul>
          </div>

          <div>
            <h3>{t('about.footer.mobileApp')}</h3>
            <p className="ab-footer__text">
              <Trans i18nKey="about.footer.appText" components={{ br: <br /> }} />
            </p>
            <div className="ab-footer__stores">
              <span className="ab-store">
                <Icon name="apple" size={18} />
                <span>
                  <small>{t('about.footer.availableOn')}</small>
                  App Store
                </span>
              </span>
              <span className="ab-store">
                <Icon name="play" size={14} className="ab-store__play" />
                <span>
                  <small>{t('about.footer.availableOn')}</small>
                  Google Play
                </span>
              </span>
            </div>
          </div>

          <div>
            <h3>{t('about.footer.newsletter')}</h3>
            <p className="ab-footer__text">
              <Trans i18nKey="about.footer.newsletterText" components={{ br: <br /> }} />
            </p>
            <form className="ab-newsletter" onSubmit={(event) => event.preventDefault()}>
              <input
                type="email"
                placeholder={t('about.footer.emailPlaceholder')}
                aria-label={t('about.footer.emailPlaceholder')}
              />
              <button type="submit" aria-label={t('about.footer.send')}>
                <Icon name="send" size={16} />
              </button>
            </form>
          </div>
        </div>

        <div className="ab-footer__bottom">
          <p>{t('about.footer.copyright')}</p>
          <ul className="ab-footer__legal">
            <li><Link to="/ci/mentions-legales">{t('about.footer.legal')}</Link></li>
            <li><Link to="/ci/mentions-legales">{t('about.footer.terms')}</Link></li>
            <li><Link to="/ci/politique-de-confidentialite">{t('about.footer.privacy')}</Link></li>
            <li><Link to="/contact">{t('about.footer.help')}</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
