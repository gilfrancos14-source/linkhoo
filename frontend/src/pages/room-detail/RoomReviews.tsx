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
        <h2 id="room-reviews-title">Avis des locataires</h2>
        <div className="room-reviews__summary">
          {reviewsData.room_avg !== null && (
            <span className="room-reviews__avg">
              ★ {reviewsData.room_avg.toFixed(1)}
              <small> ({reviewsData.room_count})</small>
            </span>
          )}
          {reviewsData.gerant_avg !== null && (
            <span className="room-reviews__avg room-reviews__avg--gerant">
              Gérant ★ {reviewsData.gerant_avg.toFixed(1)}
              <small> ({reviewsData.gerant_count})</small>
            </span>
          )}
        </div>
      </div>
      <ul className="room-reviews__list" role="list">
        {reviewsData.reviews.map((rev) => (
          <li key={rev.id} className="room-reviews__item">
            <div className="room-reviews__item-top">
              <strong>{rev.client_name}</strong>
              <span className="room-reviews__item-date">
                {formatDate(rev.created_at)}
              </span>
            </div>
            <div className="room-reviews__item-ratings">
              <span>Appartement {'★'.repeat(rev.note_appartement)}</span>
              <span>Gérant {'★'.repeat(rev.note_gerant)}</span>
            </div>
            {rev.commentaire && <p>« {rev.commentaire} »</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
