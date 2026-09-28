import { Link } from 'react-router-dom';

interface StayCardProps {
  image: string;
  alt: string;
  title: string;
  rating?: string;
  ratingType?: 'loc' | 'star';
  description: string;
  price: string;
  priceUnit: string;
  href?: string;
  ariaLabel?: string;
  tag?: string;
  badge?: string;
  badgeVariant?: 'default' | 'unavailable';
  meta?: string[];
}

export default function StayCard({
  image,
  alt,
  title,
  rating,
  ratingType = 'loc',
  description,
  price,
  priceUnit,
  href = '/',
  ariaLabel,
  tag,
  badge,
  badgeVariant = 'default',
  meta,
}: StayCardProps) {
  return (
    <article className="stay-card">
      <Link to={href} className="stay-card__link" aria-label={ariaLabel || `${title}, dès ${price} ${priceUnit}`}>
        <div className="stay-card__media">
          <img
            src={image}
            alt={alt}
            loading="lazy"
            width="400"
            height="300"
            onError={(e) => e.currentTarget.classList.add('is-hidden')}
          />
          {tag && <span className="stay-card__tag">{tag}</span>}
          {badge && (
            <span className={`stay-card__badge${badgeVariant === 'unavailable' ? ' stay-card__badge--unavailable' : ''}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="stay-card__body">
          <div className="stay-card__head">
            <h3 className="stay-card__title">{title}</h3>
            {rating && (
              <span className={`stay-card__rating${ratingType === 'loc' ? ' stay-card__rating--loc' : ''}`}>
                {ratingType === 'loc' ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/></svg>
                )}
                {rating}
              </span>
            )}
          </div>
          <p className="stay-card__desc">{description}</p>
          {meta && meta.length > 0 && (
            <ul className="stay-card__meta" aria-label="Caractéristiques">
              {meta.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          <div className="stay-card__foot">
            <p className="stay-card__price">dès <strong>{price}{'\u00A0'}{priceUnit}</strong></p>
            {meta && meta.length > 0 && (
              <span className="stay-card__arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
