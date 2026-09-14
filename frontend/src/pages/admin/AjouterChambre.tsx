import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { type Room } from '../../data/rooms';

interface FormData {
  title: string;
  description: string;
  ville: string;
  quartier: string;
  priceNum: number;
  priceUnit: '/ mois' | '/ nuit';
  conditions: string;
  chambres: number;
  douches: number;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  ville: '',
  quartier: '',
  priceNum: 0,
  priceUnit: '/ mois',
  conditions: '',
  chambres: 1,
  douches: 1,
};

const marketPays: Record<string, string> = {
  CI: 'Côte d\'Ivoire',
  BJ: 'Bénin',
};

export default function AjouterChambre() {
  const { market } = useMarket();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [previewImg, setPreviewImg] = useState(0);

  const homePath = useHomePath();
  const adminPath = `${homePath}/admin`;

  const update = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const [photoError, setPhotoError] = useState('');

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setPhotoError('');

    Array.from(files).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        setPhotoError(`"${file.name}" dépasse 2 Mo. Choisissez une image plus petite.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos((prev) => [...prev, ev.target?.result as string]);
      };
      reader.onerror = () => {
        setPhotoError('Erreur lors de la lecture du fichier.');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (mainPhotoIndex >= photos.length - 1) setMainPhotoIndex(0);
  };

  const setMain = (index: number) => setMainPhotoIndex(index);

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Le titre est requis';
    if (!form.ville.trim()) e.ville = 'La ville est requise';
    if (!form.quartier.trim()) e.quartier = 'Le quartier est requis';
    if (!form.description.trim()) e.description = 'La description est requise';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.priceNum || form.priceNum <= 0) e.priceNum = 'Le prix doit être supérieur à 0';
    if (!form.conditions.trim()) e.conditions = 'Les conditions sont requises';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Record<string, string> = {};
    if (photos.length === 0) e.photos = 'Ajoutez au moins une photo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    const room: Room = {
      id: form.title.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      title: form.title,
      subtitle: '',
      info: `${form.chambres} ch. · ${form.douches} d.`,
      price: String(form.priceNum),
      priceNum: form.priceNum,
      priceUnit: form.priceUnit,
      img: photos[mainPhotoIndex] || '',
      alt: form.title,
      images: photos,
      description: form.description,
      capacity: '',
      category: 'appartements-moins-chers',
      market,
      pays: marketPays[market] || 'Bénin',
      ville: form.ville,
      quartier: form.quartier,
      chambres: form.chambres,
      douches: form.douches,
      disponible: true,
      dateDispo: '',
      conditions: form.conditions,
    };

    const existing = JSON.parse(localStorage.getItem('ilehya-rooms') || '[]');
    existing.push(room);
    localStorage.setItem('ilehya-rooms', JSON.stringify(existing));
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="form-success">
        <div className="form-success__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0F9D6B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h2>Appartement enregistré !</h2>
        <p>{form.title} a été ajouté avec succès.</p>
        <div className="form-success__actions">
          <button className="admin-btn admin-btn--primary" onClick={() => { setForm({ ...emptyForm }); setPhotos([]); setMainPhotoIndex(0); setStep(1); setSaved(false); }}>
            Ajouter un autre
          </button>
          <button className="admin-btn" onClick={() => navigate(`${adminPath}/chambres`)}>
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="add-room">
      <div className="add-room__header">
        <div>
          <h1>Ajouter un appartement</h1>
          <p>Remplissez les informations ci-dessous pour enregistrer un nouvel appartement.</p>
        </div>
        <button className="admin-btn" onClick={() => navigate(`${adminPath}/chambres`)}>← Retour</button>
      </div>

      {/* Steps */}
      <div className="steps">
        <div className={`step ${step === 1 ? 'step--active' : ''} ${step > 1 ? 'step--done' : ''}`}>
          <span className="step__num">{step > 1 ? '' : '1'}</span>
          <span className="step__label">Identification</span>
        </div>
        <div className={`step ${step === 2 ? 'step--active' : ''} ${step > 2 ? 'step--done' : ''}`}>
          <span className="step__num">{step > 2 ? '' : '2'}</span>
          <span className="step__label">Détails</span>
        </div>
        <div className={`step ${step === 3 ? 'step--active' : ''} ${step > 3 ? 'step--done' : ''}`}>
          <span className="step__num">{step > 3 ? '' : '3'}</span>
          <span className="step__label">Photos</span>
        </div>
        <div className={`step ${step === 4 ? 'step--active' : ''}`}>
          <span className="step__num">4</span>
          <span className="step__label">Aperçu</span>
        </div>
      </div>

      <form className="add-room__form" onSubmit={(e) => e.preventDefault()}>
        {/* Step 1 — Identification */}
        {step === 1 && (
          <>
            <div className="form-grid">
              <label className={`admin-field ${errors.title ? 'admin-field--error' : ''}`}>
                <span>Titre *</span>
                <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Ex: Appartement familial" />
                {errors.title && <span className="field-error">{errors.title}</span>}
              </label>

              <label className={`admin-field ${errors.ville ? 'admin-field--error' : ''}`}>
                <span>Ville *</span>
                <input type="text" value={form.ville} onChange={(e) => update('ville', e.target.value)} placeholder="Ex: Cotonou" />
                {errors.ville && <span className="field-error">{errors.ville}</span>}
              </label>

              <label className={`admin-field ${errors.quartier ? 'admin-field--error' : ''}`}>
                <span>Quartier *</span>
                <input type="text" value={form.quartier} onChange={(e) => update('quartier', e.target.value)} placeholder="Ex: Centre-ville" />
                {errors.quartier && <span className="field-error">{errors.quartier}</span>}
              </label>
            </div>

            <label className={`admin-field admin-field--full ${errors.description ? 'admin-field--error' : ''}`}>
              <span>Description *</span>
              <textarea rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Décrivez l'appartement en détail : ambiance, équipements, points forts..." />
              {errors.description && <span className="field-error">{errors.description}</span>}
            </label>

            <div className="form-nav">
              <div className="form-nav__spacer" />
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => { if (validateStep1()) setStep(2); }}>
                Étape suivante →
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Détails */}
        {step === 2 && (
          <>
            <div className="form-grid">
              <label className={`admin-field ${errors.priceNum ? 'admin-field--error' : ''}`}>
                <span>Prix (FCFA) *</span>
                <input type="number" min={1} value={form.priceNum || ''} onChange={(e) => update('priceNum', Number(e.target.value))} placeholder="660" />
                {errors.priceNum && <span className="field-error">{errors.priceNum}</span>}
              </label>

              <label className="admin-field">
                <span>Unité de prix</span>
                <div className="radio-group">
                  <label className={`radio-btn ${form.priceUnit === '/ mois' ? 'radio-btn--active' : ''}`}>
                    <input type="radio" name="priceUnit" value="/ mois" checked={form.priceUnit === '/ mois'} onChange={() => update('priceUnit', '/ mois')} />
                    <span>Par mois</span>
                  </label>
                  <label className={`radio-btn ${form.priceUnit === '/ nuit' ? 'radio-btn--active' : ''}`}>
                    <input type="radio" name="priceUnit" value="/ nuit" checked={form.priceUnit === '/ nuit'} onChange={() => update('priceUnit', '/ nuit')} />
                    <span>Par nuit</span>
                  </label>
                </div>
              </label>

              <label className="admin-field">
                <span>Nombre de chambres</span>
                <input type="number" min={1} max={20} value={form.chambres} onChange={(e) => update('chambres', Number(e.target.value))} />
              </label>

              <label className="admin-field">
                <span>Nombre de douches</span>
                <input type="number" min={1} max={10} value={form.douches} onChange={(e) => update('douches', Number(e.target.value))} />
              </label>
            </div>

            <label className={`admin-field admin-field--full ${errors.conditions ? 'admin-field--error' : ''}`}>
              <span>Conditions *</span>
              <textarea rows={3} value={form.conditions} onChange={(e) => update('conditions', e.target.value)} placeholder="Ex: Caution 1 mois, durée min 6 mois, charges comprises..." />
              {errors.conditions && <span className="field-error">{errors.conditions}</span>}
            </label>

            <div className="form-nav">
              <button type="button" className="admin-btn" onClick={() => setStep(1)}>
                ← Étape précédente
              </button>
              <div className="form-nav__spacer" />
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => { if (validateStep2()) setStep(3); }}>
                Étape suivante →
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Photos */}
        {step === 3 && (
          <>
            <div className={`photo-section ${(errors.photos || photoError) ? 'photo-section--error' : ''}`}>
              <div className="photo-section__head">
                <span>Photos *</span>
                {(errors.photos || photoError) && <span className="field-error">{errors.photos || photoError}</span>}
              </div>

              <div className="photo-grid">
                {photos.map((src, i) => (
                  <div key={i} className={`photo-card ${i === mainPhotoIndex ? 'photo-card--main' : ''}`}>
                    <img src={src} alt={`Photo ${i + 1}`} />
                    <div className="photo-card__overlay">
                      {i !== mainPhotoIndex && (
                        <button type="button" className="photo-card__btn" onClick={() => setMain(i)} title="Définir comme principale">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                      )}
                      <button type="button" className="photo-card__btn photo-card__btn--danger" onClick={() => removePhoto(i)} title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    {i === mainPhotoIndex && <span className="photo-card__badge">Principale</span>}
                  </div>
                ))}

                <button type="button" className="photo-add" onClick={() => fileInputRef.current?.click()}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Ajouter</span>
                </button>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotos} />
            </div>

            <div className="form-nav">
              <button type="button" className="admin-btn" onClick={() => setStep(2)}>
                ← Étape précédente
              </button>
              <div className="form-nav__spacer" />
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => { if (validateStep3()) setStep(4); }}>
                Voir l'aperçu →
              </button>
            </div>
          </>
        )}

        {/* Step 4 — Preview */}
        {step === 4 && (
          <>
            <div className="preview-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Aperçu — voici comment le client verra votre annonce</span>
            </div>

            <div className="preview-card">
              {/* Gallery */}
              <div className="preview-gallery">
                {photos.length > 0 ? (
                  <>
                    <div className="preview-gallery__main">
                      <img src={photos[previewImg]} alt={form.title} />
                      {photos.length > 1 && (
                        <>
                          <button type="button" className="preview-arrow preview-arrow--prev" onClick={() => setPreviewImg(previewImg > 0 ? previewImg - 1 : photos.length - 1)}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                          <button type="button" className="preview-arrow preview-arrow--next" onClick={() => setPreviewImg(previewImg < photos.length - 1 ? previewImg + 1 : 0)}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                          </button>
                          <span className="preview-counter">{previewImg + 1} / {photos.length}</span>
                        </>
                      )}
                    </div>
                    {photos.length > 1 && (
                      <div className="preview-thumbs">
                        {photos.map((src, i) => (
                          <button key={i} type="button" className={`preview-thumb ${i === previewImg ? 'preview-thumb--active' : ''}`} onClick={() => setPreviewImg(i)}>
                            <img src={src} alt="" />
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
                  <span className="preview-info__amount">{form.priceNum > 0 ? form.priceNum.toLocaleString('fr-FR') : '—'}</span>
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

            <div className="form-nav">
              <button type="button" className="admin-btn" onClick={() => setStep(3)}>
                ← Étape précédente
              </button>
              <div className="form-nav__spacer" />
              <button type="button" className="admin-btn admin-btn--primary" onClick={handleSubmit}>
                Enregistrer l'appartement
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
