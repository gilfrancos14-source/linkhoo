import { useEffect, useState } from 'react';
import { apiReviews, type FeaturedReviewData } from '../../lib/api';
import Icon from './icons';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return (`${first.charAt(0)}${last.charAt(0)}`).toUpperCase() || '?';
}

function stayOf(review: FeaturedReviewData): string {
  const room = review.room;
  if (!room) return 'Séjour vérifié';
  const city = room.ville?.trim();
  if (city) return `Séjour à ${city}${room.market ? `, ${room.market}` : ''}`;
  return room.title ? `Séjour — ${room.title}` : 'Séjour vérifié';
}

export default function LandingReviews() {
  const [reviews, setReviews] = useState<FeaturedReviewData[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    apiReviews
      .featured()
      .then((data) => {
        if (!alive) return;
        setReviews(Array.isArray(data) ? data : []);
        setStatus('ready');
      })
      .catch(() => {
        if (!alive) return;
        setReviews([]);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === 'error') return null;
  if (status === 'ready' && reviews.length === 0) return null;

  return (
    <section className="acc-section" id="avis">
      <div className="acc-container acc-section__inner">
        <div className="acc-reviews__head">
          <div className="acc-reviews__intro">
            <span className="acc-reviews__badge">
              <Icon name="messagesSquare" size={16} />
            </span>
            <div>
              <h2 className="acc-reviews__title">Nos utilisateurs en parlent</h2>
              <p className="acc-reviews__sub">
                Découvrez les avis de nos voyageurs et de nos hôtes.
              </p>
            </div>
          </div>
          <button type="button" className="acc-link acc-reviews__link">
            Voir tous les avis
            <Icon name="arrowRight" size={14} />
          </button>
        </div>

        <div className="acc-reviews__grid" aria-busy={status === 'loading'}>
          {status === 'loading'
            ? Array.from({ length: 6 }).map((_, index) => (
                <article className="acc-review acc-review--skeleton" key={`skeleton-${index}`} aria-hidden="true">
                  <div className="acc-review__head">
                    <span className="acc-skeleton acc-skeleton--avatar" />
                    <div className="acc-review__identity">
                      <span className="acc-skeleton acc-skeleton--md" />
                      <span className="acc-skeleton acc-skeleton--sm" />
                    </div>
                  </div>
                  <span className="acc-skeleton acc-skeleton--sm" />
                  <span className="acc-skeleton acc-skeleton--line" />
                  <span className="acc-skeleton acc-skeleton--line" />
                </article>
              ))
            : reviews.map((review) => {
                const rating = review.room_avg ?? review.note_appartement;
                return (
                  <article className="acc-review" key={review.id}>
                    <div className="acc-review__head">
                      <span className="acc-review__avatar">{initialsOf(review.client_name)}</span>
                      <div className="acc-review__identity">
                        <p className="acc-review__name">{review.client_name}</p>
                        <p className="acc-review__stay">{stayOf(review)}</p>
                      </div>
                    </div>
                    <p className="acc-review__rating">
                      <Icon name="star" size={12} className="acc-star-filled acc-star-amber" />
                      <span>{rating.toFixed(1)}</span>
                    </p>
                    <p className="acc-review__text">
                      <span className="acc-review__quote">“</span>
                      {review.commentaire}”
                    </p>
                  </article>
                );
              })}
        </div>
      </div>
    </section>
  );
}
