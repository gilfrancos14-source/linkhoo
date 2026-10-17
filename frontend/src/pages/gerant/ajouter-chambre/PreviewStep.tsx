import { formatPrice } from '../../../lib/roomDisplay';
import type { FormData, PhotoItem } from './form';

/** Étape 4 — Aperçu client et enregistrement. */
export default function PreviewStep({
  photos,
  previewImg,
  form,
  submitError,
  submitting,
  onSetPreviewImg,
  onPrev,
  onSubmit,
}: {
  photos: PhotoItem[];
  previewImg: number;
  form: FormData;
  submitError: string;
  submitting: boolean;
  onSetPreviewImg: (index: number) => void;
  onPrev: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="preview-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Aperçu — voici comment le client verra votre annonce</span>
      </div>

      <div className="preview-card">
        {/* Gallery */}
        <div className="preview-gallery">
          {photos.length > 0 && photos[previewImg] ? (
            <>
              <div className="preview-gallery__main">
                <img src={photos[previewImg].preview} alt={form.title} />
                {photos.length > 1 && (
                  <>
                    <button type="button" className="preview-arrow preview-arrow--prev" onClick={() => onSetPreviewImg(previewImg > 0 ? previewImg - 1 : photos.length - 1)}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button type="button" className="preview-arrow preview-arrow--next" onClick={() => onSetPreviewImg(previewImg < photos.length - 1 ? previewImg + 1 : 0)}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <span className="preview-counter">{previewImg + 1} / {photos.length}</span>
                  </>
                )}
              </div>
              {photos.length > 1 && (
                <div className="preview-thumbs">
                  {photos.map((photo, i) => (
                    <button key={i} type="button" className={`preview-thumb ${i === previewImg ? 'preview-thumb--active' : ''}`} onClick={() => onSetPreviewImg(i)}>
                      <img src={photo.preview} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="preview-gallery__empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <span>Aucune photo</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="preview-info">
          <p className="preview-info__loc">{form.ville}{form.quartier ? `, ${form.quartier}` : ''}</p>
          <h2 className="preview-info__title">{form.title || 'Titre de l\'appartement'}</h2>
          <p className="preview-info__meta">{form.chambres} ch. · {form.douches} d.</p>

          <div className="preview-info__price">
            <span className="preview-info__amount">{form.priceNum > 0 ? formatPrice(form.priceNum) : '—'}</span>
            <span className="preview-info__currency"> FCFA {form.priceUnit}</span>
          </div>

          {form.description && (
            <div className="preview-info__section">
              <h3>Description</h3>
              <p>{form.description}</p>
            </div>
          )}

          {form.conditions && (
            <div className="preview-info__section">
              <h3>Conditions de réservation</h3>
              <ul className="preview-conditions">
                {form.conditions.split(', ').map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {submitError && <p className="field-error" role="alert">{submitError}</p>}

      <div className="form-nav">
        <button type="button" className="admin-btn" onClick={onPrev} disabled={submitting}>
          ← Étape précédente
        </button>
        <div className="form-nav__spacer" />
        <button type="button" className="admin-btn admin-btn--primary" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Enregistrement...' : "Enregistrer l'appartement"}
        </button>
      </div>
    </>
  );
}
