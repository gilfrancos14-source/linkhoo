import { Fragment, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { createRoom, type Room } from '../../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import { roomSubtitle } from '../../lib/roomDisplay';
import { apiRooms, apiUpload } from '../../lib/api';
import { containsPhoneNumber, PHONE_IN_TEXT_ERROR } from '../../utils/validators';
import {
  MAX_PHOTOS,
  emptyForm,
  marketPays,
  type FormData,
  type PhotoItem,
  type PreviewSnapshot,
} from './ajouter-chambre/form';

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

const STEPS = [
  { number: 1, title: 'Identification', subtitle: 'Catégorie et localisation' },
  { number: 2, title: 'Détails', subtitle: 'Prix et conditions' },
  { number: 3, title: 'Photos', subtitle: 'Ajoutez vos photos' },
];

export default function AjouterChambreMaq3Form({
  onPreviewChange,
}: {
  onPreviewChange?: (snapshot: PreviewSnapshot) => void;
}) {
  const { market } = useMarket();
  const navigate = useNavigate();
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [photoError, setPhotoError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCategoriesByMarket(market)
      .then((items) => {
        if (alive) setCategories(items);
      })
      .catch(() => {});
    apiRooms
      .villes(market)
      .then((items) => {
        if (alive) setCitySuggestions(items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [market]);

  const categoryTitle =
    categories.find((category) => category.id === form.category)?.title ?? '';

  useEffect(() => {
    onPreviewChange?.({ form, photos, mainPhotoIndex, categoryTitle });
  }, [form, photos, mainPhotoIndex, categoryTitle, onPreviewChange]);

  const update = (field: keyof FormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setPhotoError('');

    const available = MAX_PHOTOS - photos.length;
    if (available <= 0) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos par chambre.`);
      event.target.value = '';
      return;
    }

    const accepted: PhotoItem[] = [];
    let overflow = 0;
    Array.from(files).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        setPhotoError(`"${file.name}" dépasse 2 Mo. Choisissez une image plus petite.`);
        return;
      }
      if (accepted.length >= available) {
        overflow += 1;
        return;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    });
    if (overflow > 0) setPhotoError(`Maximum ${MAX_PHOTOS} photos par chambre.`);
    if (accepted.length > 0) {
      setPhotos((prev) => [...prev, ...accepted]);
      if (errors.photos) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.photos;
          return next;
        });
      }
    }
    event.target.value = '';
  };

  const removePhoto = (index: number) => {
    const removed = photos[index];
    if (removed && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(removed.preview);
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setMainPhotoIndex((prev) => {
      if (prev === index) return 0;
      if (prev > index) return prev - 1;
      return prev;
    });
    setPhotoError('');
  };

  const validateStep1 = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Le titre est requis';
    if (!form.ville.trim()) next.ville = 'La ville est requise';
    if (!form.quartier.trim()) next.quartier = 'Le quartier est requis';
    if (!form.description.trim()) next.description = 'La description est requise';
    else if (containsPhoneNumber(form.description)) next.description = PHONE_IN_TEXT_ERROR;
    if (!form.category) next.category = 'Choisissez une catégorie';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.priceNum || form.priceNum <= 0) next.priceNum = 'Le prix doit être supérieur à 0';
    if (!form.conditions.trim()) next.conditions = 'Les conditions sont requises';
    else if (containsPhoneNumber(form.conditions)) next.conditions = PHONE_IN_TEXT_ERROR;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep3 = (): boolean => {
    const next: Record<string, string> = {};
    if (photos.length === 0) next.photos = 'Ajoutez au moins une photo';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const goPrev = () => {
    if (step > 1) {
      setErrors({});
      setSubmitError('');
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i += 1) {
        const { url } = await apiUpload.upload(photos[i].file).catch((error: unknown) => {
          throw new Error(
            `Photo ${i + 1} refusée : ${error instanceof Error ? error.message : 'téléversement impossible'}`,
          );
        });
        urls.push(url);
      }

      const room: Omit<Room, 'id'> = {
        title: form.title,
        subtitle: roomSubtitle({
          description: form.description,
          quartier: form.quartier,
          ville: form.ville,
        }),
        info: `${form.chambres} ch. · ${form.douches} d.`,
        price: String(form.priceNum),
        priceNum: form.priceNum,
        priceUnit: form.priceUnit,
        img: urls[mainPhotoIndex] || urls[0] || '',
        alt: form.title,
        images: urls,
        description: form.description,
        category: form.category,
        market,
        pays: marketPays[market] || 'Bénin',
        ville: form.ville,
        quartier: form.quartier,
        chambres: form.chambres,
        douches: form.douches,
        disponible: true,
        dateDispo: '',
        conditions: form.conditions,
        isPopular: form.isPopular,
      };

      await createRoom(room);
      setSaved(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "L'enregistrement a échoué. Veuillez réessayer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    photos.forEach((photo) => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(photo.preview);
    });
    setForm({ ...emptyForm });
    setPhotos([]);
    setMainPhotoIndex(0);
    setStep(1);
    setSaved(false);
    setErrors({});
    setPhotoError('');
    setSubmitError('');
  };

  if (saved) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">Chambre enregistrée !</h2>
        <p className="mt-2 text-sm text-slate-500">
          {form.title} a été ajoutée avec succès.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-dash-brand px-6 py-3 text-sm font-semibold text-white hover:bg-dash-brand-dark"
            onClick={reset}
          >
            Ajouter une autre
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(chambresPath)}
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  const stepClass = (number: number) =>
    `step ${step === number ? 'on' : ''} ${step > number ? 'done' : ''}`;

  return (
    <>
      <ol className="card flex flex-wrap items-center gap-x-4 gap-y-4 p-5" aria-label="Étapes">
        {STEPS.map((item, index) => (
          <Fragment key={item.number}>
            {index > 0 && (
              <li aria-hidden="true" className="hidden h-px flex-1 bg-slate-200 md:block" />
            )}
            <li
              className={stepClass(item.number)}
              aria-current={step === item.number ? 'step' : undefined}
            >
              <span>
                {step > item.number ? (
                  <Icon id="box" className="i h-5 w-5" />
                ) : (
                  item.number
                )}
              </span>
              <div>
                <b className={step === item.number ? '' : '!font-medium'}>{item.title}</b>
                <small>{item.subtitle}</small>
              </div>
            </li>
          </Fragment>
        ))}
      </ol>

      <form
        className="card p-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 3) {
            if (validateStep3()) void handleSubmit();
            return;
          }
          goNext();
        }}
      >
        {step === 1 && (
          <>
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-dash-brand font-bold text-white">
                1
              </span>
              <div>
                <h2 className="text-lg font-bold">Identification de la chambre</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Renseignez la catégorie, le titre et la localisation.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="maq3-category" className="lbl">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                <div className={`field ${errors.category ? 'is-invalid' : ''}`}>
                  <select
                    id="maq3-category"
                    value={form.category}
                    onChange={(event) => update('category', event.target.value)}
                  >
                    <option value="">Choisir une catégorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                  <Icon id="down" />
                </div>
                {errors.category && <p className="err">{errors.category}</p>}
                <p className="hint">
                  <Icon id="info" />
                  Les catégories disponibles pour votre marché.
                </p>
              </div>

              <div>
                <label htmlFor="maq3-title" className="lbl">
                  Titre de votre chambre <span className="text-red-500">*</span>
                </label>
                <input
                  id="maq3-title"
                  className={`input ${errors.title ? 'is-invalid' : ''}`}
                  placeholder="Ex : Chambre moderne avec balcon"
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                />
                {errors.title && <p className="err">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="maq3-ville" className="lbl">
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  id="maq3-ville"
                  className={`input ${errors.ville ? 'is-invalid' : ''}`}
                  list="maq3-city-options"
                  placeholder="Ex : Cotonou"
                  value={form.ville}
                  onChange={(event) => update('ville', event.target.value)}
                />
                <datalist id="maq3-city-options">
                  {citySuggestions.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
                {errors.ville && <p className="err">{errors.ville}</p>}
              </div>

              <div>
                <label htmlFor="maq3-quartier" className="lbl">
                  Quartier <span className="text-red-500">*</span>
                </label>
                <input
                  id="maq3-quartier"
                  className={`input ${errors.quartier ? 'is-invalid' : ''}`}
                  placeholder="Ex : Centre-ville"
                  value={form.quartier}
                  onChange={(event) => update('quartier', event.target.value)}
                />
                {errors.quartier && <p className="err">{errors.quartier}</p>}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="maq3-description" className="lbl">
                Description courte <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  id="maq3-description"
                  rows={4}
                  maxLength={200}
                  className={`input resize-none ${errors.description ? 'is-invalid' : ''}`}
                  placeholder="Décrivez en quelques mots les atouts de votre chambre…"
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                />
                <span className="absolute bottom-3 right-4 text-[11px] text-slate-400">
                  {form.description.length}/200
                </span>
              </div>
              <p className="hint">
                <Icon id="info" />
                Pas de numéro de téléphone : les clients vous contactent via la messagerie.
              </p>
              {errors.description && <p className="err">{errors.description}</p>}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs text-dash-brand-dark">
              <Icon id="bulb" className="i mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">
                  Un bon titre et une description claire attirent plus de voyageurs !
                </p>
                <p className="mt-1 text-[11px] opacity-80">
                  Mettez en avant les équipements, la vue, la proximité des lieux d’intérêt…
                </p>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-dash-brand font-bold text-white">
                2
              </span>
              <div>
                <h2 className="text-lg font-bold">Détails de la chambre</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Indiquez le prix, la capacité et les conditions de réservation.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="maq3-price" className="lbl">
                  Prix (FCFA) <span className="text-red-500">*</span>
                </label>
                <input
                  id="maq3-price"
                  type="number"
                  min={1}
                  className={`input ${errors.priceNum ? 'is-invalid' : ''}`}
                  placeholder="45 000"
                  value={form.priceNum || ''}
                  onChange={(event) => update('priceNum', Number(event.target.value))}
                />
                {errors.priceNum && <p className="err">{errors.priceNum}</p>}
              </div>

              <div>
                <span className="lbl">Unité de prix</span>
                <div className="seg" role="group" aria-label="Unité de prix">
                  <button
                    type="button"
                    className={form.priceUnit === '/ mois' ? 'is-active' : ''}
                    aria-pressed={form.priceUnit === '/ mois'}
                    onClick={() => update('priceUnit', '/ mois')}
                  >
                    Par mois
                  </button>
                  <button
                    type="button"
                    className={form.priceUnit === '/ nuit' ? 'is-active' : ''}
                    aria-pressed={form.priceUnit === '/ nuit'}
                    onClick={() => update('priceUnit', '/ nuit')}
                  >
                    Par nuit
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="maq3-chambres" className="lbl">
                  Nombre de chambres
                </label>
                <input
                  id="maq3-chambres"
                  type="number"
                  min={1}
                  max={20}
                  className="input"
                  value={form.chambres}
                  onChange={(event) => update('chambres', Number(event.target.value))}
                />
              </div>

              <div>
                <label htmlFor="maq3-douches" className="lbl">
                  Nombre de douches
                </label>
                <input
                  id="maq3-douches"
                  type="number"
                  min={1}
                  max={10}
                  className="input"
                  value={form.douches}
                  onChange={(event) => update('douches', Number(event.target.value))}
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="maq3-conditions" className="lbl">
                Conditions <span className="text-red-500">*</span>
              </label>
              <textarea
                id="maq3-conditions"
                rows={3}
                className={`input resize-none ${errors.conditions ? 'is-invalid' : ''}`}
                placeholder="Ex : Caution 1 mois, durée min 6 mois, charges comprises…"
                value={form.conditions}
                onChange={(event) => update('conditions', event.target.value)}
              />
              <p className="hint">
                <Icon id="info" />
                Pas de numéro de téléphone : les clients vous contactent via la messagerie.
              </p>
              {errors.conditions && <p className="err">{errors.conditions}</p>}
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                style={{ accentColor: '#f97316' }}
                checked={form.isPopular}
                onChange={(event) => update('isPopular', event.target.checked)}
              />
              <span>
                Marquer comme chambre populaire
                <small className="mt-0.5 block text-xs text-slate-500">
                  Affichée dans « Les plus louées ».
                </small>
              </span>
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-dash-brand font-bold text-white">
                3
              </span>
              <div>
                <h2 className="text-lg font-bold">Photos de la chambre</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajoutez jusqu’à {MAX_PHOTOS} photos, la première sera la principale.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  Photos <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-slate-500">
                  {photos.length} / {MAX_PHOTOS}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo, index) => (
                  <div
                    key={`${photo.preview}-${index}`}
                    className={`photo-tile ${index === mainPhotoIndex ? 'is-main' : ''}`}
                  >
                    <img src={photo.preview} alt={`Photo ${index + 1}`} />
                    <div className="photo-tile__actions">
                      {index !== mainPhotoIndex && (
                        <button
                          type="button"
                          title="Définir comme principale"
                          onClick={() => setMainPhotoIndex(index)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        title="Supprimer"
                        onClick={() => removePhoto(index)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    {index === mainPhotoIndex && (
                      <span className="photo-tile__badge">Principale</span>
                    )}
                  </div>
                ))}

                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    className="photo-add"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Ajouter</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handlePhotos}
              />

              <p className="hint">
                <Icon id="info" />
                JPG ou PNG, 2 Mo maximum. Photos intérieures et extérieures uniquement, sans
                personne visible.
              </p>
              {(errors.photos || photoError) && (
                <p className="err">{errors.photos || photoError}</p>
              )}
            </div>
          </>
        )}

        {submitError && (
          <p className="err mt-4" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={goPrev}
              disabled={submitting}
            >
              <Icon id="back" className="i h-4 w-4" />
              Étape précédente
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              type="submit"
              className="inline-flex items-center gap-3 rounded-lg bg-dash-brand px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 hover:bg-dash-brand-dark"
            >
              Suivant
              <Icon id="next" className="i h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex items-center gap-3 rounded-lg bg-dash-brand px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 hover:bg-dash-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer la chambre'}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
