import { useState } from 'react';
import { Link } from 'react-router-dom';
import { priceWithCurrency } from '../lib/roomDisplay';
import type { Room } from '../data/rooms';
import Icon from './landing/icons';

interface SearchStayCardProps {
  room: Room;
  href: string;
  meta: string[];
  /** `featured` : carte de la sélection premium (carrousel en tête de page). */
  variant?: 'default' | 'featured';
}

export default function SearchStayCard({
  room,
  href,
  meta,
  variant = 'default',
}: SearchStayCardProps) {
  const [saved, setSaved] = useState(false);
  const displayPrice = priceWithCurrency(room.price, room.priceUnit);
  const priceLabel = `${room.title}, dès ${displayPrice} ${room.priceUnit ?? ''}`.trim();
  const tag =
    variant === 'featured'
      ? 'À la une'
      : room.isPopular || room.gerantPremium
        ? 'Coup de cœur'
        : undefined;
  const badge = !room.disponible
    ? 'Indisponible'
    : room.gerantPremium
      ? 'Premium'
      : room.gerantVerified
        ? 'Hôte vérifié'
        : undefined;
  const badgeVariant = !room.disponible
    ? 'unavailable'
    : room.gerantPremium
      ? 'premium'
      : room.gerantVerified
        ? 'verified'
        : 'default';
  const location = [room.quartier, room.ville].filter(Boolean).join(' · ');

  return (
    <article className={`stay-card${variant === 'featured' ? ' stay-card--featured' : ''}`}>
      <div className="stay-card__media">
        <Link to={href} className="stay-card__media-link" aria-label={priceLabel}>
          <img
            src={room.img}
            alt={room.alt}
            loading="lazy"
            width="640"
            height="400"
            onError={(event) => event.currentTarget.classList.add('is-hidden')}
          />
        </Link>
        <span className="stay-card__media-shade" aria-hidden="true" />

        {(tag || badge) && (
          <div className="stay-card__badges">
            {tag && <span className="stay-card__tag">{tag}</span>}
            {badge && (
              <span
                className={`stay-card__badge${
                  badgeVariant === 'default' ? '' : ` stay-card__badge--${badgeVariant}`
                }`}
              >
                {badge}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          className={`stay-card__favorite${saved ? ' is-saved' : ''}`}
          aria-label={saved ? `Retirer ${room.title} des favoris` : `Sauvegarder ${room.title}`}
          aria-pressed={saved}
          onClick={() => setSaved((value) => !value)}
        >
          <Icon name="heart" size={18} />
        </button>

        {room.info?.trim() && (
          <span className="stay-card__rating">
            <Icon name="star" size={14} />
            <strong>{room.info.trim()}</strong>
          </span>
        )}
      </div>

      <div className="stay-card__body">
        <p className="stay-card__eyebrow">
          <Icon name="mapPin" size={15} />
          {location}
        </p>
        <Link to={href} className="stay-card__title-link">
          <h3 className="stay-card__title">{room.title}</h3>
        </Link>
        {meta.length > 0 && (
          <ul className="stay-card__meta" aria-label="Caractéristiques">
            {meta.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="stay-card__foot">
        <p className="stay-card__price">
          <strong>{displayPrice}</strong>
          <span>{room.priceUnit}</span>
        </p>
        <Link to={href} className="stay-card__arrow" aria-label={`Voir ${room.title}`}>
          <Icon name="arrowRight" size={19} />
        </Link>
      </div>
    </article>
  );
}
