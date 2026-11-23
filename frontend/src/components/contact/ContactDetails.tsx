import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

const SOCIALS = [
  { name: 'facebook' as const, label: 'Facebook' },
  { name: 'twitter' as const, label: 'X' },
  { name: 'instagram' as const, label: 'Instagram' },
  { name: 'youtube' as const, label: 'YouTube' },
  { name: 'linkedin' as const, label: 'LinkedIn' },
  { name: 'music2' as const, label: 'TikTok' },
];

export default function ContactDetails() {
  const { t } = useTranslation();
  const d = (key: string) => t(`contact.details.${key}`);

  return (
    <aside className="ct-card ct-details">
      <h2 className="ct-details__title">{d('title')}</h2>
      <p className="ct-details__lead">{d('lead')}</p>

      <ul className="ct-details__list" role="list">
        <li>
          <span className="ct-details__icon">
            <Icon name="mail" size={14} />
          </span>
          <div>
            <p className="ct-details__label">{d('email')}</p>
            <a href="mailto:contact@linkhoo.com">contact@linkhoo.com</a>
            <p className="ct-details__note">{d('responseTime')}</p>
          </div>
        </li>
        <li>
          <span className="ct-details__icon">
            <Icon name="phone" size={14} />
          </span>
          <div>
            <p className="ct-details__label">{d('phone')}</p>
            <a href="tel:+2290160000000">+229 01 60 00 00 00</a>
            <p className="ct-details__note">{d('hours')}</p>
          </div>
        </li>
        <li>
          <span className="ct-details__icon">
            <Icon name="mapPin" size={14} />
          </span>
          <div>
            <p className="ct-details__label">{d('address')}</p>
            <p className="ct-details__value">{d('addressValue')}</p>
            <p className="ct-details__note">{d('headquarters')}</p>
          </div>
        </li>
      </ul>

      <div className="ct-details__social">
        <h3>{d('socialTitle')}</h3>
        <p>{d('socialText')}</p>
        <div className="ct-details__socials">
          {SOCIALS.map((social) => (
            <span key={social.label} aria-label={social.label} role="img">
              <Icon name={social.name} size={11} />
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
