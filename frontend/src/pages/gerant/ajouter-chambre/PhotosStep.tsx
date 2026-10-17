import type { RefObject } from 'react';
import { MAX_PHOTOS, type PhotoItem } from './form';

/** Étape 3 — Photos de l'appartement. */
export default function PhotosStep({
  photos,
  mainPhotoIndex,
  errors,
  photoError,
  fileInputRef,
  onPhotosChange,
  onRemovePhoto,
  onSetMain,
  onPrev,
  onNext,
}: {
  photos: PhotoItem[];
  mainPhotoIndex: number;
  errors: Record<string, string>;
  photoError: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPhotosChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onSetMain: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className={`photo-section ${(errors.photos || photoError) ? 'photo-section--error' : ''}`}>
        <div className="photo-section__head">
          <span>Photos *</span>
          <span>{photos.length} / {MAX_PHOTOS}</span>
          {(errors.photos || photoError) && <span className="field-error">{errors.photos || photoError}</span>}
        </div>

        <div className="photo-grid">
          {photos.map((photo, i) => (
            <div key={i} className={`photo-card ${i === mainPhotoIndex ? 'photo-card--main' : ''}`}>
              <img src={photo.preview} alt={`Photo ${i + 1}`} />
              <div className="photo-card__overlay">
                {i !== mainPhotoIndex && (
                  <button type="button" className="photo-card__btn" onClick={() => onSetMain(i)} title="Définir comme principale">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </button>
                )}
                <button type="button" className="photo-card__btn photo-card__btn--danger" onClick={() => onRemovePhoto(i)} title="Supprimer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {i === mainPhotoIndex && <span className="photo-card__badge">Principale</span>}
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button type="button" className="photo-add" onClick={() => fileInputRef.current?.click()}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Ajouter</span>
            </button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPhotosChange} />

        <p className="photo-hint">
          Photos intérieures et extérieures de l'appartement uniquement, sans personne visible.
        </p>
      </div>

      <div className="form-nav">
        <button type="button" className="admin-btn" onClick={onPrev}>
          ← Étape précédente
        </button>
        <div className="form-nav__spacer" />
        <button type="button" className="admin-btn admin-btn--primary" onClick={onNext}>
          Voir l'aperçu →
        </button>
      </div>
    </>
  );
}
