import { useEffect, useState } from 'react';
import { apiReviews, type FeaturedReviewData } from '../lib/api';
import CardSkeleton from './CardSkeleton';

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/>
    </svg>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return (`${first.charAt(0)}${last.charAt(0)}`).toUpperCase() || '?';
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<FeaturedReviewData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiReviews
      .featured()
      .then((data) => {
        if (!alive) return;
        setReviews(data);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setReviews([]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Pas d'avis (ou erreur) : la section disparaît, comme avant.
  if (!loading && reviews.length === 0) return null;

  return (
    <section className="reviews" id="avis">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Ils ont loué ou séjourné chez nous</p>
          <h2 className="section-title">Ce qu'ils <em>en disent</em></h2>
        </div>

        <div className="reviews__grid" aria-busy={loading}>
          {loading ? (
            <CardSkeleton count={3} />
          ) : (
            reviews.map((review) => (
              <figure key={review.id} className="review reveal">
                <div
                  className="review__stars"
                  aria-label={`Note : ${review.note_appartement} étoiles sur 5`}
                >
                  {Array.from({ length: review.note_appartement }).map((_, j) => (
                    <StarIcon key={j} />
                  ))}
                </div>
                <blockquote className="review__quote">« {review.commentaire} »</blockquote>
                <figcaption className="review__author">
                  <span className="review__avatar" aria-hidden="true">
                    {initialsOf(review.client_name)}
                  </span>
                  <span>
                    <strong>{review.client_name}</strong>
                    {review.room?.title && <small>Séjour — {review.room.title}</small>}
                  </span>
                </figcaption>
              </figure>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
