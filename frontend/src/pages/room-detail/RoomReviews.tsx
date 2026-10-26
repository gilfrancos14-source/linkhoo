import type { RoomReviewsResponse } from '../../lib/api';
import { formatDate } from '../../lib/formatDate';

interface RoomReviewsProps {
  reviewsData: RoomReviewsResponse | null;
}

export default function RoomReviews({ reviewsData }: RoomReviewsProps) {
  if (!reviewsData || reviewsData.reviews.length === 0) return null;

  return (
    <section className="room-reviews" aria-labelledby="room-reviews-title">
      <div className="room-reviews__head">
        <h2 id="room-reviews-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1z"/></svg>
          Avis des locataires
        </h2>
        <div className="room-reviews__summary">
          {reviewsData.room_avg !== null && (
            <span className="room-reviews__avg">
              Note globale <span className="room-reviews__star" aria-hidden="true">★</span>{' '}
              <b>{reviewsData.room_avg.toFixed(1)}</b>{' '}
              <small>({reviewsData.room_count})</small>
            </span>
          )}
          {reviewsData.gerant_avg !== null && (
            <span className="room-reviews__avg room-reviews__avg--gerant">
              Gérant <span className="room-reviews__star" aria-hidden="true">★</span>{' '}
              <b>{reviewsData.gerant_avg.toFixed(1)}</b>{' '}
              <small>({reviewsData.gerant_count})</small>
            </span>
          )}
        </div>
      </div>
      <ul className="room-reviews__list" role="list">
        {reviewsData.reviews.map((rev) => (
          <li key={rev.id} className="room-reviews__item">
            <div className="room-reviews__author">
              <span className="room-reviews__avatar" aria-hidden="true">
                {rev.client_name.slice(0, 1).toUpperCase()}
              </span>
              <div className="room-reviews__author-info">
                <strong>{rev.client_name}</strong>
                <span className="room-reviews__item-date">{formatDate(rev.created_at)}</span>
                {rev.commentaire && <p>« {rev.commentaire} »</p>}
              </div>
            </div>
            <div className="room-reviews__item-ratings">
              <span>Appartement {'★'.repeat(rev.note_appartement)}</span>
              <span>Gérant {'★'.repeat(rev.note_gerant)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
