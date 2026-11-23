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

export default function ContactFooter() {
  const { t } = useTranslation();
  const f = (key: string) => t(`contact.footer.${key}`);

  return (
    <footer className="ct-footer">
      <div className="ct-footer__inner">
        <div className="ct-footer__grid">
          <div className="ct-footer__brand">
            <Link to="/" className="ct-footer__logo">
              <Icon name="house" size={26} />
              <span>Linkhoo</span>
            </Link>
            <p className="ct-footer__desc">
              <Trans i18nKey="contact.footer.desc" components={{ br: <br /> }} />
            </p>
            <div className="ct-footer__socials">
              {SOCIALS.map((social) => (
                <span key={social.label} aria-label={social.label} role="img">
                  <Icon name={social.name} size={12} />
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3>{f('usefulLinks')}</h3>
            <ul className="ct-footer__list">
              <li><Link to="/">{t('navigation.home')}</Link></li>
              <li><Link to="/a-propos">{t('navigation.about')}</Link></li>
              <li><Link to="/contact">{t('navigation.contact')}</Link></li>
              <li><Link to="/contact">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3>{f('markets')}</h3>
            <ul className="ct-footer__list">
              <li><Link to="/sn">{f('countries.senegal')}</Link></li>
              <li><Link to="/ci">{f('countries.ivoryCoast')}</Link></li>
              <li><Link to="/bj">{f('countries.benin')}</Link></li>
              <li><Link to="/ml">{f('countries.mali')}</Link></li>
              <li>{f('moreCountries')}</li>
            </ul>
          </div>

          <div>
            <h3>{f('mobileApp')}</h3>
            <p className="ct-footer__text">
              <Trans i18nKey="contact.footer.appText" components={{ br: <br /> }} />
            </p>
            <div className="ct-footer__stores">
              <span className="ct-store">
                <Icon name="apple" size={14} />
                <span>
                  <small>{f('appStoreLabel')}</small>
                  App Store
                </span>
              </span>
              <span className="ct-store">
                <Icon name="play" size={11} className="ct-store__play" />
                <span>
                  <small>{f('googlePlayLabel')}</small>
                  Google Play
                </span>
              </span>
            </div>
          </div>

          <div>
            <h3>{f('newsletter')}</h3>
            <p className="ct-footer__text">
              <Trans i18nKey="contact.footer.newsletterText" components={{ br: <br /> }} />
            </p>
            <form className="ct-newsletter" onSubmit={(event) => event.preventDefault()}>
              <input type="email" placeholder={f('emailPlaceholder')} aria-label={f('emailPlaceholder')} />
              <button type="submit" aria-label={f('send')}>
                <Icon name="send" size={12} />
              </button>
            </form>
          </div>
        </div>

        <div className="ct-footer__bottom">
          <div>
            <p>{f('copyright')}</p>
            <ul className="ct-footer__legal">
              <li><Link to="/ci/mentions-legales">{f('legal')}</Link></li>
              <li><Link to="/ci/mentions-legales">{f('terms')}</Link></li>
              <li><Link to="/ci/politique-de-confidentialite">{f('privacy')}</Link></li>
              <li><Link to="/contact">{f('help')}</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
