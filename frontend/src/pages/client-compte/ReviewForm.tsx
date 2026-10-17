import type { FormEvent } from 'react';
import Stars from './Stars';
import type { ReviewFormState } from './types';

/** Modale de dépôt d'avis (notes appartement/gérant + commentaire). */
export default function ReviewForm({
  form,
  error,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ReviewFormState;
  error: string;
  submitting: boolean;
  onChange: (patch: Partial<ReviewFormState>) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="review-form__overlay" role="dialog" aria-modal="true" aria-labelledby="review-form-title">
      <form className="review-form" onSubmit={onSubmit}>
        <div className="review-form__head">
          <div>
            <p className="eyebrow">Nouvel avis</p>
            <h2 id="review-form-title">{form.roomTitle}</h2>
          </div>
          <button
            type="button"
            className="review-form__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="review-form__field">
          <span className="review-form__label">Note de l'appartement</span>
          <Stars
            value={form.noteAppartement}
            onChange={(v) => onChange({ noteAppartement: v })}
            label="Note de l'appartement"
          />
        </div>

        <div className="review-form__field">
          <span className="review-form__label">Note du gérant</span>
          <Stars
            value={form.noteGerant}
            onChange={(v) => onChange({ noteGerant: v })}
            label="Note du gérant"
          />
        </div>

        <div className="review-form__field">
          <label className="review-form__label" htmlFor="review-comment">
            Votre expérience
          </label>
          <textarea
            id="review-comment"
            rows={4}
            maxLength={2000}
            placeholder="Racontez votre séjour..."
            value={form.commentaire}
            onChange={(e) => onChange({ commentaire: e.target.value })}
          />
        </div>

        {error && (
          <p className="client-compte__error" role="alert">{error}</p>
        )}

        <div className="review-form__actions">
          <button
            type="button"
            className="client-compte__btn"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="client-compte__btn client-compte__btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Envoi...' : 'Publier mon avis'}
          </button>
        </div>
      </form>
    </div>
  );
}
