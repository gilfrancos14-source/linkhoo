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
  return (
    <aside className="ct-card ct-details">
      <h2 className="ct-details__title">Nos coordonnées</h2>
      <p className="ct-details__lead">
        Vous pouvez aussi nous contacter directement via les informations ci-dessous.
      </p>

      <ul className="ct-details__list" role="list">
        <li>
          <span className="ct-details__icon">
            <Icon name="mail" size={14} />
          </span>
          <div>
            <p className="ct-details__label">Email</p>
            <a href="mailto:contact@linkhoo.com">contact@linkhoo.com</a>
            <p className="ct-details__note">Réponse sous 24h</p>
          </div>
        </li>
        <li>
          <span className="ct-details__icon">
            <Icon name="phone" size={14} />
          </span>
          <div>
            <p className="ct-details__label">Téléphone</p>
            <a href="tel:+2290160000000">+229 01 60 00 00 00</a>
            <p className="ct-details__note">Lun - Ven : 8h - 22h</p>
          </div>
        </li>
        <li>
          <span className="ct-details__icon">
            <Icon name="mapPin" size={14} />
          </span>
          <div>
            <p className="ct-details__label">Adresse</p>
            <p className="ct-details__value">Cotonou, Bénin</p>
            <p className="ct-details__note">Siège social de Linkhoo</p>
          </div>
        </li>
      </ul>

      <div className="ct-details__social">
        <h3>Suivez-nous</h3>
        <p>Restez connecté avec nous sur les réseaux sociaux.</p>
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
