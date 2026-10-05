import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineQueueSync } from '../hooks/useOfflineQueueSync';
import { fetchRoomById, type Room } from '../data/rooms';
import { fetchCategoriesByMarket } from '../data/categories';
import { isValidEmail } from '../utils/validators';
import { addReservation } from '../lib/reservations';
import { enqueue, newClientKey } from '../lib/offlineQueue';
import { isPremiumActive } from '../lib/premium';
import {
  DUREE_MAX_MOIS,
  DUREE_MAX_NUIT,
  computeDateFin,
  isValidDateStr,
  maxDuree,
  nightsBetween,
  pluralDuree,
  type DureeUnite,
} from '../lib/duration';
import { apiReviews, type RoomReviewsResponse } from '../lib/api';
import { priceWithCurrency, roomSubtitle } from '../lib/roomDisplay';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  dateDebut?: string;
  duree?: string;
}

function initialDuree(searchParams: URLSearchParams): string {
  const arrivee = searchParams.get('arrivee');
  const depart = searchParams.get('depart');
  const nights = arrivee && depart ? nightsBetween(arrivee, depart) : null;
  if (nights && nights >= 1) return String(Math.min(nights, DUREE_MAX_NUIT));
  return '1';
}

function validateForm(
  data: { name: string; email: string; phone: string; dateDebut: string; duree: number },
  unite: DureeUnite,
): FormErrors {
  const errors: FormErrors = {};
  if (!data.name.trim()) errors.name = 'Veuillez renseigner votre nom.';
  if (!data.email.trim()) {
    errors.email = 'Veuillez renseigner votre email.';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Adresse email invalide.';
  }
  if (!data.phone.trim()) {
    errors.phone = 'Veuillez renseigner votre téléphone.';
  } else if (!/^[\d\s+()-]{6,}$/.test(data.phone)) {
    errors.phone = 'Numéro de téléphone invalide.';
  }
  if (!data.dateDebut) {
    errors.dateDebut = 'Veuillez choisir une date de début.';
  } else if (!isValidDateStr(data.dateDebut)) {
    errors.dateDebut = 'Date de début invalide.';
  }
  const max = maxDuree(unite);
  if (!Number.isInteger(data.duree) || data.duree < 1) {
    errors.duree = 'Veuillez saisir une durée valide.';
  } else if (data.duree > max) {
    errors.duree = `La durée maximale est de ${max} ${unite === 'mois' ? 'mois' : 'nuits'}.`;
  }
  return errors;
}

export default function RoomDetailPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useAuth();
  // La fiche est chargée directement par son identifiant : la page ne
  // télécharge plus tout le catalogue du marché pour retrouver une ligne.
  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    dateDebut: searchParams.get('arrivee') ?? '',
  });
  const [duree, setDuree] = useState(() => initialDuree(searchParams));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const online = useOnlineStatus();
  const [queued, setQueued] = useState(false);
  useOfflineQueueSync();
  const [shareFeedback, setShareFeedback] = useState(false);
  const [reviewsData, setReviewsData] = useState<RoomReviewsResponse | null>(null);
  // Clé d'idempotence de la soumission en cours : la même clé accompagne
  // l'envoi en ligne et sa copie en file offline, donc un retry (timeout,
  // retour de connexion) renvoie la réservation existante au lieu d'en
  // créer une seconde. Réinitialisée après succès (nouvelle soumission = nouvelle clé).
  const clientKeyRef = useRef<string | null>(null);

  const clerkSignedIn = clerkConfigured && userLoaded && Boolean(isSignedIn);

  useEffect(() => {
    if (!clerkSignedIn || !user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
    setFormData((prev) => ({
      ...prev,
      name: prev.name || fullName,
      email: prev.email || email,
    }));
  }, [clerkSignedIn, user]);

  useEffect(() => {
    let cancelled = false;
    fetchCategoriesByMarket(market)
      .then((loaded) => {
        if (!cancelled) setCategories(loaded);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setRoom(null);
    fetchRoomById(id)
      .then((fullRoom) => {
        if (!cancelled) setRoom(fullRoom);
      })
      .catch(() => {
        if (!cancelled) setRoom(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    apiReviews.listByRoom(id).then(setReviewsData).catch(() => setReviewsData(null));
  }, [id, submitted]);

  const category = room ? categories.find((c: any) => c.id === room.category) : null;
  const isMonthly = room?.priceUnit === '/ mois';
  const unite: DureeUnite = isMonthly ? 'mois' : 'nuit';
  const dureeNombre = Number(duree);
  const dureeValide = Number.isInteger(dureeNombre) && dureeNombre >= 1;

  useEffect(() => {
    if (!isMonthly) return;
    setDuree((prev) => {
      const n = Number(prev);
      if (!Number.isFinite(n) || n < 1) return '1';
      if (n <= DUREE_MAX_MOIS) return String(Math.max(1, Math.round(n / 30)));
      return String(DUREE_MAX_MOIS);
    });
  }, [isMonthly]);

  const effectiveDateFin =
    formData.dateDebut && dureeValide
      ? computeDateFin(formData.dateDebut, dureeNombre, unite)
      : '';

  const estimatedMontant =
    room && formData.dateDebut && dureeValide
      ? room.priceNum * dureeNombre
      : null;

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const partialData = { name: formData.name, email: formData.email, phone: formData.phone, dateDebut: formData.dateDebut, duree: dureeNombre };
    const validation = validateForm(partialData, unite);
    if (field in validation) {
      setErrors((prev) => ({ ...prev, [field]: validation[field as keyof FormErrors] }));
    } else {
      setErrors((prev) => { const next = { ...prev }; delete next[field as keyof FormErrors]; return next; });
    }
  }, [formData, dureeNombre, unite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm({ ...formData, duree: dureeNombre }, unite);
    setErrors(validation);
    setTouched({ name: true, email: true, phone: true, dateDebut: true, duree: true });
    if (Object.keys(validation).length > 0) return;
    if (!room) return;

    setSubmitting(true);
    setSubmitError('');

    if (!clientKeyRef.current) clientKeyRef.current = newClientKey();

    const payload = {
      clientName: formData.name,
      clientEmail: formData.email,
      clientPhone: formData.phone,
      roomId: room.id,
      roomTitle: room.title,
      dateDebut: formData.dateDebut,
      dateFin: effectiveDateFin,
      dureeNombre,
      dureeUnite: unite,
      montant: estimatedMontant ?? room.priceNum,
      message: formData.message,
      clientKey: clientKeyRef.current,
    };

    // Hors-ligne : la demande est mise en file d'attente et partira
    // automatiquement au retour de la connexion.
    if (!online) {
      enqueue({ type: 'reservation', payload });
      clientKeyRef.current = null;
      setQueued(true);
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    try {
      await addReservation(payload);
      clientKeyRef.current = null;
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 2000);
    } catch {
      // Fallback silencieux
    }
  };

  if (loading) {
    return (
      <main className="room-detail">
        <div className="container">
          <p className="room-detail__empty">Chargement...</p>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="room-detail">
        <div className="container">
          <nav className="room-detail__breadcrumb" aria-label="Fil d'Ariane">
            <Link to={homePath}>Accueil</Link> <span aria-hidden="true">/</span> <span>Chambre introuvable</span>
          </nav>
          <p className="room-detail__empty">Chambre introuvable.</p>
          <Link to={homePath} className="room-detail__back">← Retour à l'accueil</Link>
        </div>
      </main>
    );
  }

  // Bien saisi sans sous-titre : on retombe sur la première phrase de la
  // description plutôt que d'afficher une ligne vide.
  const subtitleText = roomSubtitle(room);
  const priceText = priceWithCurrency(room.price, room.priceUnit);

  return (
    <main className="room-detail">
      <div className="container">
        <nav className="room-detail__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath}>Accueil</Link>
          <span aria-hidden="true">/</span>
          {category && (
            <>
              <Link to={`${homePath}/categorie/${category.id}`}>{category.title}</Link>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span aria-current="page">{room.title}</span>
        </nav>

        <div className="room-detail__top-row">
          <Link to={homePath} className="room-detail__back">← Retour</Link>
          <button
            type="button"
            className="room-detail__share"
            onClick={handleShare}
            aria-label="Copier le lien de cette page"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
            {shareFeedback ? 'Lien copié !' : 'Partager'}
          </button>
        </div>

        <p className="room-detail__gallery-label">{room.title}</p>

        <div className="room-detail__gallery">
          <div className="room-detail__main-img">
            {room.images.length > 0 ? (
              <>
                <img src={room.images[activeImg]} alt={`${room.title} — photo ${activeImg + 1} sur ${room.images.length}`} />
                <span className="room-detail__img-counter" aria-live="polite" aria-atomic="true">
                  Photo {activeImg + 1} sur {room.images.length}
                </span>
                <button type="button" className="room-detail__img-arrow room-detail__img-arrow--prev" aria-label="Photo précédente" onClick={() => setActiveImg(activeImg > 0 ? activeImg - 1 : room.images.length - 1)}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button type="button" className="room-detail__img-arrow room-detail__img-arrow--next" aria-label="Photo suivante" onClick={() => setActiveImg(activeImg < room.images.length - 1 ? activeImg + 1 : 0)}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '14px' }}>
                Aucune photo disponible
              </div>
            )}
          </div>
          <div className="room-detail__thumbs">
            {room.images.map((img, i) => (
              <button
                key={i}
                type="button"
                className={`room-detail__thumb${i === activeImg ? ' is-active' : ''}`}
                onClick={() => setActiveImg(i)}
                aria-label={`Voir la photo ${i + 1}`}
              >
                <img src={img} alt={`${room.title} — aperçu ${i + 1}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="room-detail__content">
          <div className="room-detail__info">
            <p className="eyebrow">{room.info}</p>
            <h1 className="room-detail__title">{room.title}</h1>
            {subtitleText && <p className="room-detail__subtitle">{subtitleText}</p>}

            <div className="room-detail__price-box">
              <p className="room-detail__price">dès <strong>{priceText}</strong> <span>{room.priceUnit}</span></p>
            </div>

            <div className="room-detail__desc">
              <h2>Description</h2>
              <p>{room.description}</p>
            </div>

            <div className="room-detail__conditions">
              <h2>Conditions de réservation</h2>
              <ul>
                {room.conditions.split(', ').map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            {room.gerant?.is_verified && isPremiumActive(room.gerant) && (
              <div className="host-card">
                <h2 className="host-card__title">Votre hôte</h2>
                <div className="host-card__card">
                  <div className="host-card__name">{room.gerant.prenom} {room.gerant.nom}</div>
                  <div className="host-card__badges">
                    <span className="host-card__badge host-card__badge--verified">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Vérifié
                    </span>
                    <span className="host-card__badge host-card__badge--premium">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      Premium
                    </span>
                  </div>
                  {room.gerant.phone && (
                    <a href={`tel:${room.gerant.phone}`} className="host-card__phone">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                      {room.gerant.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {reviewsData && reviewsData.reviews.length > 0 && (
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
                          {new Date(rev.created_at).toLocaleDateString('fr-FR')}
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
            )}
          </div>

          <div className="room-detail__form-box">
            <h2>Demande de réservation</h2>
            {!online && !submitted && (
              <p className="room-detail__offline" role="status">
                Vous êtes hors-ligne : votre demande sera enregistrée puis
                envoyée automatiquement au retour de la connexion.
              </p>
            )}
            {!clerkSignedIn && !submitted && (
              <div className="room-detail__auth-cta">
                <p>Connectez-vous pour pré-remplir vos infos et suivre facilement vos réservations.</p>
                <div className="room-detail__auth-cta-actions">
                  <Link to={`/${market.toLowerCase()}/login`} className="room-detail__auth-btn room-detail__auth-btn--primary">
                    Se connecter
                  </Link>
                  <Link to={`/${market.toLowerCase()}/inscription`} className="room-detail__auth-btn">
                    Créer un compte
                  </Link>
                </div>
              </div>
            )}
            {submitted ? (
              <div className="room-detail__success" role="status">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--sun)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                {queued ? (
                  <>
                    <p>Votre demande a été enregistrée hors-ligne.</p>
                    <p>Elle sera envoyée automatiquement dès le retour de la connexion.</p>
                  </>
                ) : (
                  <>
                    <p>Votre demande a bien été envoyée !</p>
                    <p>Nous vous recontacterons dans les plus brefs délais.</p>
                    <Link to={clerkSignedIn ? `/${market.toLowerCase()}/compte` : `${homePath}/suivi-reservation`} className="room-detail__track-link">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <path d="M16 2v4M8 2v4M3 10h18"/>
                      </svg>
                      Suivre ma réservation
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <form className="room-detail__form" onSubmit={handleSubmit} noValidate>
                <div className="room-detail__field">
                  <label htmlFor="rd-name">Nom complet <span aria-hidden="true">*</span></label>
                  <input
                    id="rd-name"
                    type="text"
                    required
                    placeholder="Votre nom"
                    autoComplete="name"
                    aria-required="true"
                    aria-invalid={!!errors.name && touched.name}
                    aria-describedby={errors.name ? 'rd-name-error' : undefined}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onBlur={() => handleBlur('name')}
                  />
                  {errors.name && touched.name && (
                    <p className="room-detail__field-error" id="rd-name-error" role="alert">{errors.name}</p>
                  )}
                </div>
                <div className="room-detail__field">
                  <label htmlFor="rd-email">Email <span aria-hidden="true">*</span></label>
                  <input
                    id="rd-email"
                    type="email"
                    required
                    placeholder="Votre email"
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={!!errors.email && touched.email}
                    aria-describedby={errors.email ? 'rd-email-error' : undefined}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => handleBlur('email')}
                  />
                  {errors.email && touched.email && (
                    <p className="room-detail__field-error" id="rd-email-error" role="alert">{errors.email}</p>
                  )}
                </div>
                <div className="room-detail__field">
                  <label htmlFor="rd-phone">Téléphone <span aria-hidden="true">*</span></label>
                  <input
                    id="rd-phone"
                    type="tel"
                    required
                    placeholder="Votre téléphone"
                    autoComplete="tel"
                    inputMode="tel"
                    aria-required="true"
                    aria-invalid={!!errors.phone && touched.phone}
                    aria-describedby={errors.phone ? 'rd-phone-error' : undefined}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={() => handleBlur('phone')}
                  />
                  {errors.phone && touched.phone && (
                    <p className="room-detail__field-error" id="rd-phone-error" role="alert">{errors.phone}</p>
                  )}
                </div>
                <div className="room-detail__field-row">
                  <div className="room-detail__field">
                    <label htmlFor="rd-date-debut">Date de début <span aria-hidden="true">*</span></label>
                    <input
                      id="rd-date-debut"
                      type="date"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.dateDebut && touched.dateDebut}
                      aria-describedby={errors.dateDebut ? 'rd-date-debut-error' : undefined}
                      value={formData.dateDebut}
                      onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                      onBlur={() => handleBlur('dateDebut')}
                    />
                    {errors.dateDebut && touched.dateDebut && (
                      <p className="room-detail__field-error" id="rd-date-debut-error" role="alert">{errors.dateDebut}</p>
                    )}
                  </div>
                  <div className="room-detail__field">
                    <label htmlFor="rd-duree">Durée <span aria-hidden="true">*</span></label>
                    <input
                      id="rd-duree"
                      type="number"
                      min={1}
                      max={maxDuree(unite)}
                      step={1}
                      required
                      aria-required="true"
                      aria-invalid={!!errors.duree && touched.duree}
                      aria-describedby={errors.duree ? 'rd-duree-error' : undefined}
                      value={duree}
                      onChange={(e) => setDuree(e.target.value)}
                      onBlur={() => handleBlur('duree')}
                    />
                    {errors.duree && touched.duree && (
                      <p className="room-detail__field-error" id="rd-duree-error" role="alert">{errors.duree}</p>
                    )}
                  </div>
                  <div className="room-detail__field">
                    <label htmlFor="rd-unite">Unité <span aria-hidden="true">*</span></label>
                    <select id="rd-unite" value={unite} disabled aria-required="true">
                      <option value={unite}>{unite === 'mois' ? 'mois' : 'nuit'}</option>
                    </select>
                  </div>
                </div>
                {effectiveDateFin && (
                  <div className="room-detail__field">
                    <label htmlFor="rd-date-fin">Date de fin (calculée)</label>
                    <input
                      id="rd-date-fin"
                      type="date"
                      value={effectiveDateFin}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                )}
                {effectiveDateFin && estimatedMontant !== null && (
                  <p className="room-detail__field" style={{ margin: 0, fontSize: '14px', color: 'var(--ink-soft)' }}>
                    Du {formData.dateDebut} au {effectiveDateFin} · {pluralDuree(dureeNombre, unite)} — estimation :{' '}
                    <strong>{estimatedMontant.toLocaleString('fr-FR')} FCFA</strong>
                  </p>
                )}
                <div className="room-detail__field">
                  <label htmlFor="rd-msg">Message</label>
                  <textarea id="rd-msg" rows={4} placeholder="Questions supplémentaires..." value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
                </div>
                {submitError && (
                  <p className="room-detail__field-error" role="alert">{submitError}</p>
                )}
                <button type="submit" className="room-detail__submit" disabled={submitting}>
                  {submitting ? 'Envoi en cours...' : 'Envoyer la demande'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
