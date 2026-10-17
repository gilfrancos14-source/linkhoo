import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineQueueSync } from '../hooks/useOfflineQueueSync';
import { fetchRoomById, type Room } from '../data/rooms';
import { fetchCategoriesByMarket } from '../data/categories';
import { addReservation } from '../lib/reservations';
import { enqueue, newClientKey } from '../lib/offlineQueue';
import {
  DUREE_MAX_MOIS,
  computeDateFin,
  type DureeUnite,
} from '../lib/duration';
import { apiReviews, apiMessages, apiAuth, type RoomReviewsResponse } from '../lib/api';
import { priceWithCurrency, roomSubtitle } from '../lib/roomDisplay';
import { initialDuree, validateForm, whatsappHref, type FormErrors } from './room-detail/roomForm';
import RoomGallery from './room-detail/RoomGallery';
import HostCard from './room-detail/HostCard';
import RoomReviews from './room-detail/RoomReviews';
import ReservationBox from './room-detail/ReservationBox';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

export default function RoomDetailPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const navigate = useNavigate();
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
  // Bouton « Message » de la carte hôte : visible pour les clients connectés
  // uniquement (un gérant connecté n'ouvre pas de conversation vers lui-même).
  const [isClient, setIsClient] = useState(false);
  const [msgLoading, setMessageLoading] = useState(false);
  const [msgError, setMsgError] = useState('');
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

  useEffect(() => {
    if (!clerkSignedIn) return;
    apiAuth
      .me()
      .then((me) => setIsClient(me.role === 'client'))
      .catch(() => setIsClient(false));
  }, [clerkSignedIn]);

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

  const handleFieldChange = useCallback((patch: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

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
  const waHref = room.gerant?.phone
    ? whatsappHref(
        room.gerant.phone,
        `Bonjour, je vous contacte au sujet de la chambre « ${room.title} » (${room.ville}${
          room.quartier ? ` — ${room.quartier}` : ''
        }) dès ${priceText}. Lien : ${window.location.href}`,
      )
    : null;

  // Ouvre (ou récupère) la conversation client ↔ gérant pour cette chambre,
  // puis bascule sur le fil de discussion. Idempotent côté serveur.
  const handleStartConversation = async () => {
    if (msgLoading) return;
    setMessageLoading(true);
    setMsgError('');
    try {
      const conversation = await apiMessages.getOrCreateConversation(room.id);
      navigate(`${homePath}/messages/${conversation.id}`);
    } catch {
      setMsgError("Impossible d'ouvrir la discussion. Veuillez réessayer.");
    } finally {
      setMessageLoading(false);
    }
  };

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

        <RoomGallery room={room} activeImg={activeImg} onSelect={setActiveImg} />

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

            {room.gerant?.is_verified && (
              <HostCard
                gerant={room.gerant}
                isClient={isClient}
                waHref={waHref}
                msgLoading={msgLoading}
                msgError={msgError}
                onStartConversation={handleStartConversation}
              />
            )}

            <RoomReviews reviewsData={reviewsData} />

          </div>

          <ReservationBox
            online={online}
            submitted={submitted}
            queued={queued}
            clerkSignedIn={clerkSignedIn}
            market={market}
            homePath={homePath}
            formData={formData}
            duree={duree}
            unite={unite}
            errors={errors}
            touched={touched}
            submitting={submitting}
            submitError={submitError}
            effectiveDateFin={effectiveDateFin}
            estimatedMontant={estimatedMontant}
            dureeNombre={dureeNombre}
            onChange={handleFieldChange}
            onDureeChange={setDuree}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
          />

        </div>
      </div>
    </main>
  );
}
