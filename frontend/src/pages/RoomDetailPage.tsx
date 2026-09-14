import { useParams, Link } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { getRoomsByMarket } from '../data/rooms';
import { getCategoriesByMarket } from '../data/categories';
import { isValidEmail } from '../utils/validators';
import { addNotification } from '../lib/notifications';
import { addReservation } from '../lib/reservations';
import { sendWhatsAppReservation } from '../lib/whatsapp';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  dateDebut?: string;
  dateFin?: string;
}

function validateForm(data: { name: string; email: string; phone: string; dateDebut: string; dateFin: string }): FormErrors {
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
  }
  if (!data.dateFin) {
    errors.dateFin = 'Veuillez choisir une date de fin.';
  }
  if (data.dateDebut && data.dateFin && new Date(data.dateFin) <= new Date(data.dateDebut)) {
    errors.dateFin = 'La date de fin doit être après la date de début.';
  }
  return errors;
}

export default function RoomDetailPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const { id } = useParams<{ id: string }>();
  const rooms = getRoomsByMarket(market);
  const room = rooms.find((r) => r.id === id);
  const categories = getCategoriesByMarket(market);
  const [activeImg, setActiveImg] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', dateDebut: '', dateFin: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  const category = room ? categories.find((c) => c.id === room.category) : null;

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const partialData = { name: formData.name, email: formData.email, phone: formData.phone, dateDebut: formData.dateDebut, dateFin: formData.dateFin };
    const validation = validateForm(partialData);
    if (field in validation) {
      setErrors((prev) => ({ ...prev, [field]: validation[field as keyof FormErrors] }));
    } else {
      setErrors((prev) => { const next = { ...prev }; delete next[field as keyof FormErrors]; return next; });
    }
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm(formData);
    setErrors(validation);
    setTouched({ name: true, email: true, phone: true, dateDebut: true, dateFin: true });
    if (Object.keys(validation).length > 0) return;
    if (!room) return;

    const reservation = addReservation({
      clientName: formData.name,
      clientEmail: formData.email,
      clientPhone: formData.phone,
      roomId: room.id,
      roomTitle: room.title,
      dateDebut: formData.dateDebut,
      dateFin: formData.dateFin,
      montant: room.priceNum,
      message: formData.message,
    });

    addNotification({
      type: 'reservation',
      roomTitle: room.title,
      roomId: room.id,
      clientName: formData.name,
      clientEmail: formData.email,
      clientPhone: formData.phone,
      message: formData.message,
      reservationId: reservation.id,
    });

    localStorage.setItem('ilehya-client-email', formData.email);

    sendWhatsAppReservation({
      clientName: formData.name,
      clientEmail: formData.email,
      clientPhone: formData.phone,
      roomTitle: room.title,
      roomPrice: `${room.price} ${room.priceUnit}`,
      roomInfo: room.info,
      dateDebut: formData.dateDebut,
      dateFin: formData.dateFin,
      message: formData.message,
    });

    setSubmitted(true);
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
            <p className="room-detail__subtitle">{room.subtitle}</p>

            <div className="room-detail__price-box">
              <p className="room-detail__price">dès <strong>{room.price}</strong> <span>{room.priceUnit}</span></p>
              <p className="room-detail__capacity">Capacité : {room.capacity}</p>
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
          </div>

          <div className="room-detail__form-box">
            <h2>Demande de réservation</h2>
            {submitted ? (
              <div className="room-detail__success" role="status">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--sun)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                <p>Votre demande a bien été envoyée !</p>
                <p>Nous vous recontacterons dans les plus brefs délais.</p>
                <Link to={`${homePath}/suivi-reservation`} className="room-detail__track-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                  Suivre ma réservation
                </Link>
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
                    <label htmlFor="rd-date-fin">Date de fin <span aria-hidden="true">*</span></label>
                    <input
                      id="rd-date-fin"
                      type="date"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.dateFin && touched.dateFin}
                      aria-describedby={errors.dateFin ? 'rd-date-fin-error' : undefined}
                      value={formData.dateFin}
                      onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                      onBlur={() => handleBlur('dateFin')}
                    />
                    {errors.dateFin && touched.dateFin && (
                      <p className="room-detail__field-error" id="rd-date-fin-error" role="alert">{errors.dateFin}</p>
                    )}
                  </div>
                </div>
                <div className="room-detail__field">
                  <label htmlFor="rd-msg">Message</label>
                  <textarea id="rd-msg" rows={4} placeholder="Questions supplémentaires..." value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
                </div>
                <button type="submit" className="room-detail__submit">Envoyer la demande</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
