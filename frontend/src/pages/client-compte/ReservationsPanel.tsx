import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ClientMineReservationData } from '../../lib/api';
import Glyph, { glyphCalendar, glyphStar } from './Glyph';
import ReservationCard from './ReservationCard';
import ReviewForm from './ReviewForm';
import type { ReviewFormState } from './types';

/** Panneau « Mes réservations » : états de chargement, liste, avis. */
export default function ReservationsPanel({
  homePath,
  loading,
  reservations,
  reviewsError,
  reviewable,
  reviewedIds,
  reviewSuccess,
  reviewForm,
  reviewError,
  reviewSubmitting,
  cancellingId,
  onCancel,
  onOpenReviewForm,
  onChangeReview,
  onCloseReview,
  onSubmitReview,
}: {
  homePath: string;
  loading: boolean;
  reservations: ClientMineReservationData[];
  reviewsError: boolean;
  reviewable: ClientMineReservationData[];
  reviewedIds: Set<string | undefined>;
  reviewSuccess: string;
  reviewForm: ReviewFormState | null;
  reviewError: string;
  reviewSubmitting: boolean;
  cancellingId: string | null;
  onCancel: (id: string) => void;
  onOpenReviewForm: (reservation: ClientMineReservationData) => void;
  onChangeReview: (patch: Partial<ReviewFormState>) => void;
  onCloseReview: () => void;
  onSubmitReview: (e: FormEvent) => void;
}) {
  return (
    <section className="client-compte__panel" id="cp-panel" role="tabpanel">
      {loading ? (
        <div className="client-compte__loading">
          <div className="auth-loading__spinner" />
          <p>Chargement de vos réservations…</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="client-compte__empty">
          <span className="client-compte__empty-icon"><Glyph>{glyphCalendar}</Glyph></span>
          <p className="client-compte__empty-title">Aucune réservation pour le moment</p>
          <p className="client-compte__empty-note">
            Dès que vous réserverez un séjour, il apparaîtra ici avec son statut en temps réel.
          </p>
          <Link to={homePath} className="client-compte__btn client-compte__btn--primary">
            Parcourir les appartements
          </Link>
        </div>
      ) : (
        <div className="client-compte__list">
          {reservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              canReview={!reviewsError && reviewable.some((x) => x.id === r.id)}
              isReviewed={reviewedIds.has(r.id)}
              cancellingId={cancellingId}
              onCancel={onCancel}
              onReview={onOpenReviewForm}
            />
          ))}
        </div>
      )}

      {reviewsError && (
        <p className="client-compte__error" role="status">
          Impossible de charger vos avis : le bouton « Laisser un avis » est masqué
          pour éviter de publier deux fois le même séjour.
        </p>
      )}

      {!reviewsError && reviewable.length > 0 && !reviewForm && (
        <div className="client-compte__hint">
          <span className="client-compte__hint-icon"><Glyph>{glyphStar}</Glyph></span>
          <p>Vous avez {reviewable.length} séjour(s) confirmé(s) que vous pouvez noter.</p>
        </div>
      )}

      {reviewSuccess && (
        <p className="client-compte__success" role="status">{reviewSuccess}</p>
      )}

      {reviewForm && (
        <ReviewForm
          form={reviewForm}
          error={reviewError}
          submitting={reviewSubmitting}
          onChange={onChangeReview}
          onClose={onCloseReview}
          onSubmit={onSubmitReview}
        />
      )}
    </section>
  );
}
