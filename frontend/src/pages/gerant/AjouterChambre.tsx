import { useState, useRef, useEffect } from 'react';
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
} from './ajouter-chambre/form';
import AddRoomStepper from './ajouter-chambre/AddRoomStepper';
import AddRoomSuccess from './ajouter-chambre/AddRoomSuccess';
import IdentificationStep from './ajouter-chambre/IdentificationStep';
import DetailsStep from './ajouter-chambre/DetailsStep';
import PhotosStep from './ajouter-chambre/PhotosStep';
import PreviewStep from './ajouter-chambre/PreviewStep';

export default function AjouterChambre() {
  const { market } = useMarket();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [previewImg, setPreviewImg] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;

  useEffect(() => {
    fetchCategoriesByMarket(market).then(setCategories);
    // Suggestions de villes du marché — saisie assistée.
    apiRooms.villes(market).then(setCitySuggestions).catch(() => {});
  }, [market]);

  const update = (field: keyof FormData, value: string | number | boolean) => {
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

    const available = MAX_PHOTOS - photos.length;
    if (available <= 0) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos par appartement.`);
      e.target.value = '';
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
    if (overflow > 0) setPhotoError(`Maximum ${MAX_PHOTOS} photos par appartement.`);
    if (accepted.length > 0) setPhotos((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    const nextLength = photos.length - 1;
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    // previewImg doit suivre la taille de la liste : sans ça, revenir sur
    // l'étape 4 après une suppression lit photos[previewImg] hors bornes
    // et plante (ErrorBoundary en boucle, formulaire perdu).
    setPreviewImg((p) => Math.min(p, Math.max(nextLength - 1, 0)));
    setPhotoError('');
    setMainPhotoIndex((prev) => {
      if (prev === index) return 0;
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const setMain = (index: number) => setMainPhotoIndex(index);

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Le titre est requis';
    if (!form.ville.trim()) e.ville = 'La ville est requise';
    if (!form.quartier.trim()) e.quartier = 'Le quartier est requis';
    if (!form.description.trim()) e.description = 'La description est requise';
    else if (containsPhoneNumber(form.description)) e.description = PHONE_IN_TEXT_ERROR;
    if (!form.category) e.category = 'Choisissez une catégorie';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.priceNum || form.priceNum <= 0) e.priceNum = 'Le prix doit être supérieur à 0';
    if (!form.conditions.trim()) e.conditions = 'Les conditions sont requises';
    else if (containsPhoneNumber(form.conditions)) e.conditions = PHONE_IN_TEXT_ERROR;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Record<string, string> = {};
    if (photos.length === 0) e.photos = 'Ajoutez au moins une photo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const { url } = await apiUpload.upload(photos[i].file).catch((err: unknown) => {
          throw new Error(`Photo ${i + 1} refusée : ${err instanceof Error ? err.message : 'téléversement impossible'}`);
        });
        urls.push(url);
      }

      const room: Omit<Room, 'id'> = {
        title: form.title,
        // Accroche de carte : première phrase de la description, sinon le lieu.
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
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "L'enregistrement a échoué. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <AddRoomSuccess
        title={form.title}
        onAddAnother={() => { setForm({ ...emptyForm }); setPhotos([]); setMainPhotoIndex(0); setStep(1); setSaved(false); }}
        onBackToList={() => navigate(`${gerantPath}/chambres`)}
      />
    );
  }

  return (
    <div className="add-room">
      <div className="add-room__header">
        <div>
          <h1>Ajouter un appartement</h1>
          <p>Remplissez les informations ci-dessous pour enregistrer un nouvel appartement.</p>
        </div>
        <button className="admin-btn" onClick={() => navigate(`${gerantPath}/chambres`)}>← Retour</button>
      </div>

      <AddRoomStepper step={step} />

      <form className="add-room__form" onSubmit={(e) => e.preventDefault()}>
        {/* Step 1 — Identification */}
        {step === 1 && (
          <IdentificationStep
            form={form}
            errors={errors}
            categories={categories}
            citySuggestions={citySuggestions}
            onUpdate={update}
            onNext={() => { if (validateStep1()) setStep(2); }}
          />
        )}

        {/* Step 2 — Détails */}
        {step === 2 && (
          <DetailsStep
            form={form}
            errors={errors}
            onUpdate={update}
            onPrev={() => setStep(1)}
            onNext={() => { if (validateStep2()) setStep(3); }}
          />
        )}

        {/* Step 3 — Photos */}
        {step === 3 && (
          <PhotosStep
            photos={photos}
            mainPhotoIndex={mainPhotoIndex}
            errors={errors}
            photoError={photoError}
            fileInputRef={fileInputRef}
            onPhotosChange={handlePhotos}
            onRemovePhoto={removePhoto}
            onSetMain={setMain}
            onPrev={() => setStep(2)}
            onNext={() => { if (validateStep3()) setStep(4); }}
          />
        )}

        {/* Step 4 — Preview */}
        {step === 4 && (
          <PreviewStep
            photos={photos}
            previewImg={previewImg}
            form={form}
            submitError={submitError}
            submitting={submitting}
            onSetPreviewImg={setPreviewImg}
            onPrev={() => setStep(3)}
            onSubmit={handleSubmit}
          />
        )}
      </form>
    </div>
  );
}
