import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import LandingHeader from '../components/landing/LandingHeader';
import { COUNTRIES } from '../components/landing/data';
import { MAQUETTE_NAV_ITEMS } from '../maquette/nav';
import { fetchCategoriesByMarket, type Category } from '../data/categories';
import { fetchRoomById, type Room } from '../data/rooms';
import { apiMessages, apiReviews, type RoomReviewsResponse } from '../lib/api';
import {
  computeDateFin,
  maxDuree,
  pluralDuree,
  type DureeUnite,
} from '../lib/duration';
import { formatDate } from '../lib/formatDate';
import { redirectTo } from '../lib/navigation';
import { isPremiumActive } from '../lib/premium';
import { addReservation } from '../lib/reservations';
import { conditionIcon, conditionLabel } from '../lib/roomConditions';
import { formatCapacity, priceWithCurrency } from '../lib/roomDisplay';
import { initialDuree, validateForm, type FormErrors } from './room-detail/roomForm';

/* -------------------------------------------------------------------------- */
/*  Icônes (jeu proche de Lucide, comme dans la maquette maq7.html)           */
/* -------------------------------------------------------------------------- */

const ICON_PATHS = {
  airVent: (
    <>
      <path d="M18 17.5a2.5 2.5 0 1 1-4 2.03V12" />
      <path d="M6 12h6" />
      <path d="M6 8h12" />
      <path d="M6.6 15.57A2 2 0 1 0 10 17v-5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  bath: (
    <>
      <path d="M10 4 8 6" />
      <path d="M17 19v2" />
      <path d="M2 12h20" />
      <path d="M7 19v2" />
      <path d="M9 5 7.62 3.62A2.12 2.12 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </>
  ),
  bedDouble: (
    <>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M12 4v6" />
      <path d="M2 18h20" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  camera: (
    <>
      <path d="M14 4a2 2 0 0 1 1.76 1.05l.49.9A2 2 0 0 0 18 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2a2 2 0 0 0 1.76-1.05l.49-.9A2 2 0 0 1 10 4z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  cigaretteOff: (
    <>
      <path d="M12 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h13" />
      <path d="M18 8c0-2.5-2-2.5-2-5" />
      <path d="m2 2 20 20" />
      <path d="M21 12a1 1 0 0 1 1 1v2a1 1 0 0 1-.5.87" />
      <path d="M22 8c0-2.5-2-2.5-2-5" />
      <path d="M7 12v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  house: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  map: (
    <>
      <path d="M14.1 5.55a2 2 0 0 0 1.79 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.55 2.27a2 2 0 0 1-1.79 0l-4.21-2.1a2 2 0 0 0-1.79 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.55-2.27a2 2 0 0 1 1.79 0z" />
      <path d="M15 5.76v15M9 3.24v15" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  moreVertical: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  partyPopper: (
    <>
      <path d="M5.8 11.3 2 22l10.7-3.79" />
      <path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01" />
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
      <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17" />
      <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" />
      <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
    </>
  ),
  pawPrint: (
    <>
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  share: (
    <>
      <path d="M12 2v13" />
      <path d="m16 6-4-4-4 4" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  star: (
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  ),
  thumbsUp: (
    <>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
  ),
  wifi: (
    <>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.86a10 10 0 0 1 14 0" />
      <path d="M8.5 16.43a5 5 0 0 1 7 0" />
    </>
  ),
} as const satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function frenchDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** « septembre 2026 » — ancienneté de l'hôte (colonne `gerants.created_at`). */
function memberSince(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Étoiles reflétant une note réelle (0 à 5) — les étoiles non atteintes restent vides. */
function RatingStars({ value, className = 'h-3.5 w-3.5' }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span
      className="flex text-amber-400"
      role="img"
      aria-label={`${frenchDecimal(value)} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Icon
          key={index}
          name="star"
          className={`${className} ${index <= rounded ? 'fill-current' : 'text-amber-300'}`}
        />
      ))}
    </span>
  );
}

/**
 * Photo de galerie tolérante aux fichiers manquants : les données de
 * démonstration référencent parfois des images absentes de `public/images`.
 * Sans ce garde-fou, le navigateur affiche l'icône « image cassée » et le
 * texte alternatif à la place du visuel.
 */
function GalleryPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function reservationPayloadData(room: Room, form: FormState, dureeNombre: number, unite: DureeUnite) {
  return {
    clientName: form.name,
    clientEmail: form.email,
    clientPhone: form.phone,
    roomId: room.id,
    roomTitle: room.title,
    dateDebut: form.dateDebut,
    dateFin: computeDateFin(form.dateDebut, dureeNombre, unite),
    dureeNombre,
    dureeUnite: unite,
    montant: room.priceNum * dureeNombre,
  };
}

const CONDITION_ICONS: Record<string, IconName> = {
  'i-clock': 'clock',
  'i-shield': 'shieldCheck',
  'i-ban': 'cigaretteOff',
  'i-paw': 'pawPrint',
  'i-list': 'clock',
};

function conditionIconName(condition: string): IconName {
  return CONDITION_ICONS[conditionIcon(condition)] ?? 'clock';
}


interface FormState {
  name: string;
  email: string;
  phone: string;
  dateDebut: string;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function RoomDetailMaq7() {
  const navigate = useNavigate();
  const homePath = useHomePath();
  const { market } = useMarket();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewsData, setReviewsData] = useState<RoomReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cur, setCur] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState('');

  const [form, setForm] = useState<FormState>(() => ({
    name: '',
    email: '',
    phone: '',
    dateDebut: searchParams.get('arrivee') ?? '',
  }));
  const [duree, setDuree] = useState(() => initialDuree(searchParams));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const signedIn = authLoaded && Boolean(isSignedIn);

  /* ----- Chargement des données ----- */

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
      .then((loaded) => {
        if (!cancelled) setRoom(loaded);
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
    let cancelled = false;
    apiReviews
      .listByRoom(id)
      .then((data) => {
        if (!cancelled) setReviewsData(data);
      })
      .catch(() => {
        if (!cancelled) setReviewsData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ----- Pré-remplissage client connecté ----- */

  useEffect(() => {
    if (!signedIn || !user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const email =
      user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
    setForm((prev) => ({
      ...prev,
      name: prev.name || fullName,
      email: prev.email || email,
    }));
  }, [signedIn, user]);

  useEffect(() => {
    setCur(0);
  }, [room?.id]);

  /* ----- Valeurs dérivées ----- */

  const category = useMemo(
    () => (room ? categories.find((item) => item.id === room.category) : null),
    [categories, room],
  );

  const photos = useMemo(() => {
    if (!room) return [];
    const list = room.images.filter((src) => Boolean(src && src.trim()));
    if (list.length > 0) return list;
    return room.img ? [room.img] : [];
  }, [room]);

  const safeCur = photos.length > 0 ? Math.min(cur, photos.length - 1) : 0;

  const isMonthly = room?.priceUnit === '/ mois';
  const unite: DureeUnite = isMonthly ? 'mois' : 'nuit';
  const dureeNombre = Number(duree);
  const dureeValide =
    Number.isInteger(dureeNombre) && dureeNombre >= 1 && dureeNombre <= maxDuree(unite);

  const dateFin =
    form.dateDebut && dureeValide ? computeDateFin(form.dateDebut, dureeNombre, unite) : '';

  const montantEstime = room && dureeValide ? room.priceNum * dureeNombre : 0;

  const conditions = useMemo(
    () =>
      room
        ? room.conditions
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    [room],
  );

  const location = room ? [room.quartier, room.ville, room.pays].filter(Boolean).join(', ') : '';
  const priceText = room ? priceWithCurrency(room.price, room.priceUnit) : '';
  const roomAvg = reviewsData?.room_avg ?? null;
  const roomCount = reviewsData?.room_count ?? 0;
  const reviews = reviewsData?.reviews ?? [];
  const gerantAvg = reviewsData?.gerant_avg ?? null;
  const gerantCount = reviewsData?.gerant_count ?? 0;

  /* ----- Galerie ----- */

  const showPhoto = (index: number) => {
    if (photos.length === 0) return;
    setCur((index + photos.length) % photos.length);
  };

  /* ----- Partage ----- */

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Le lien reste copiable manuellement si le presse-papiers est indisponible.
    }
    setShareFeedback(true);
    window.setTimeout(() => setShareFeedback(false), 2000);
  };

  /* ----- Formulaire de réservation ----- */

  const updateField = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const validation = validateForm(
        {
          name: form.name,
          email: form.email,
          phone: form.phone,
          dateDebut: form.dateDebut,
          duree: dureeNombre,
        },
        unite,
      );
      const key = field as keyof FormErrors;
      setErrors((prev) => {
        const next = { ...prev };
        if (validation[key]) next[key] = validation[key];
        else delete next[key];
        return next;
      });
    },
    [form, dureeNombre, unite],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) return;

    const validation = validateForm(
      {
        name: form.name,
        email: form.email,
        phone: form.phone,
        dateDebut: form.dateDebut,
        duree: dureeNombre,
      },
      unite,
    );
    setErrors(validation);
    setTouched({ name: true, email: true, phone: true, dateDebut: true, duree: true });
    if (Object.keys(validation).length > 0) {
      setContactOpen(true);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await addReservation(reservationPayloadData(room, form, dureeNombre, unite));
      // Paiement en ligne disponible : on emmène le client sur le checkout
      // hébergé Hub2. La réservation est déjà enregistrée et reste consultable
      // depuis son compte si le paiement est abandonné.
      const checkoutUrl = created?.payment?.checkout_url;
      if (checkoutUrl) {
        redirectTo(checkoutUrl);
        return;
      }
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetRequest = () => {
    setSubmitted(false);
    setErrors({});
    setTouched({});
    setSubmitError('');
  };

  /* ----- Contact hôte ----- */

  const handleContactHost = async () => {
    if (!room || msgLoading) return;
    setMsgError('');
    if (!signedIn) {
      navigate(`${homePath}/login`);
      return;
    }
    setMsgLoading(true);
    try {
      const conversation = await apiMessages.getOrCreateConversation(room.id);
      navigate(`${homePath}/messages/${conversation.id}`);
    } catch {
      setMsgError("Impossible d'ouvrir la discussion. Veuillez réessayer.");
    } finally {
      setMsgLoading(false);
    }
  };

  /* ----- Rendu : chargement / introuvable ----- */

  if (loading) {
    return (
      <div className="room-detail-maq7 min-h-screen bg-[#F6F8FB] font-sans text-ink antialiased">
        <MarketHeader homePath={homePath} market={market} />
        <main className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
          <p className="text-sm text-mute" role="status">
            Chargement de la chambre…
          </p>
        </main>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="room-detail-maq7 min-h-screen bg-[#F6F8FB] font-sans text-ink antialiased">
        <MarketHeader homePath={homePath} market={market} />
        <main className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
          <p className="text-base font-semibold">Chambre introuvable</p>
          <Link
            to={homePath}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="room-detail-maq7 min-h-screen bg-[#F6F8FB] font-sans text-ink antialiased">
      <MarketHeader homePath={homePath} market={market} />

      <main className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
        {/* Fil d'Ariane */}
        <nav
          className="mb-4 hidden items-center gap-2 text-xs text-mute lg:flex"
          aria-label="Fil d'Ariane"
        >
          <Link to={homePath} className="hover:text-brand">
            Accueil
          </Link>
          <Icon name="chevronRight" className="h-3 w-3" />
          <span>{room.ville}</span>
          <Icon name="chevronRight" className="h-3 w-3" />
          <span>{room.quartier}</span>
          <Icon name="chevronRight" className="h-3 w-3" />
          <span className="text-ink">{room.title}</span>
        </nav>

        {/* Galerie */}
        <section className="m7-gallery grid gap-3" aria-label="Galerie photos">
          <div className="m7-gallery__main relative overflow-hidden rounded-2xl bg-slate-200">
            {photos.length > 0 ? (
              <>
                <GalleryPhoto
                  src={photos[safeCur]}
                  alt={`${room.title} — photo ${safeCur + 1} sur ${photos.length}`}
                  className="m7-gallery__img"
                />
                <button
                  type="button"
                  onClick={() => showPhoto(safeCur - 1)}
                  className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow"
                  aria-label="Photo précédente"
                >
                  <Icon name="chevronLeft" className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => showPhoto(safeCur + 1)}
                  className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow"
                  aria-label="Photo suivante"
                >
                  <Icon name="chevronRight" className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white">
                  <Icon name="camera" className="h-4 w-4" /> {safeCur + 1}/{photos.length}
                </span>
              </>
            ) : (
              <div className="grid h-full place-items-center text-sm text-mute">
                Aucune photo disponible.
              </div>
            )}
          </div>

          <div className="m7-gallery__side relative gap-3">
            {[1, 2, 3].map((photoIndex) => {
              const photo = photos[photoIndex];
              const showMore = photoIndex === 3 && photos.length > 4;

              if (!photo) {
                return (
                  <div
                    key={`placeholder-${photoIndex}`}
                    className="m7-gallery__thumb overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-300"
                  />
                );
              }

              return (
                <button
                  key={`${photo}-${photoIndex}`}
                  type="button"
                  onClick={() => showPhoto(photoIndex)}
                  className="m7-gallery__thumb relative overflow-hidden rounded-xl bg-slate-200"
                  aria-label={`Voir la photo ${photoIndex + 1}`}
                >
                  <GalleryPhoto
                    src={photo}
                    alt={`${room.title} — aperçu ${photoIndex + 1}`}
                    className="m7-gallery__img"
                  />
                  {showMore && (
                    <span className="absolute inset-0 grid place-items-center bg-black/30 text-2xl font-bold text-white">
                      +{photos.length - 4}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Grille principale */}
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[1fr_340px]">
          {/* En-tête annonce */}
          <section className="order-1 lg:col-start-1">
            <div className="flex items-start justify-between">
              <span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-600">
                {category?.title ?? 'Chambre privée'}
              </span>
              <div className="hidden gap-4 lg:flex">
                <button type="button" onClick={handleShare} aria-label="Partager">
                  <Icon name="share" />
                </button>
                <button type="button" aria-label="Ajouter aux favoris">
                  <Icon name="heart" />
                </button>
                {shareFeedback && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white">
                    <Icon name="check" className="h-3.5 w-3.5" />
                    Lien copié !
                  </span>
                )}
              </div>
            </div>

            <h1 className="mt-2 text-2xl font-extrabold leading-tight lg:text-[28px]">
              {room.title}
            </h1>

            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-mute">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mapPin" className="h-4 w-4" />
                {location}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-sky-600">
                <Icon name="map" className="h-3.5 w-3.5" />
                Voir sur la carte
              </span>
            </p>

            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Icon name="star" className="h-4 w-4 fill-amber-400 text-amber-400" />
              <b>{roomAvg !== null ? frenchDecimal(roomAvg) : '—'}</b>
              <span className="text-mute">
                ({roomCount} avis)
              </span>
              {roomAvg !== null && roomAvg >= 4 && (
                <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                  Excellent
                </span>
              )}
            </p>

            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line pb-8 text-[13px] text-slate-600 sm:grid-cols-4">
              <li className="flex items-center gap-2">
                <Icon name="bedDouble" /> 1 lit double
              </li>
              <li className="flex items-center gap-2">
                <Icon name="bath" /> Salle de bain privée
              </li>
              <li className="flex items-center gap-2">
                <Icon name="wifi" /> Wi-Fi gratuit
              </li>
              <li className="flex items-center gap-2">
                <Icon name="airVent" /> Climatisation
              </li>
            </ul>
          </section>

          {/* Aside : réservation + hôte */}
          <aside className="contents lg:sticky lg:top-24 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:block lg:self-start lg:space-y-5">
            {/* Réservation */}
            <section
              className="order-2 rounded-2xl border border-line bg-white p-5 shadow-sm"
              aria-label="Réservation"
            >
              <p className="text-[13px] text-mute">
                dès <b className="text-xl font-extrabold text-brand">{priceText}</b>{' '}
                {room.priceUnit}
              </p>
              <p className="mt-1 text-xs text-mute">
                {room.capacity
                  ? `Pour ${formatCapacity(Number(room.capacity))}`
                  : 'Pour 1 personne'}
              </p>

              {submitted ? (
                <div className="py-6 text-center" role="status">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <Icon name="check" className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">Demande envoyée !</h3>
                  <p className="mt-1 text-xs text-mute">
                    Votre demande a bien été transmise au gérant. Vous serez recontacté
                    rapidement.
                  </p>
                  <button
                    type="button"
                    onClick={resetRequest}
                    className="mt-4 w-full rounded-lg border border-brand py-2.5 text-[13px] font-bold text-brand transition hover:bg-brand-soft"
                  >
                    Retourner à l&apos;annonce
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <p className="mt-4 text-[13px] font-bold">Dates de séjour</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label
                      className="block rounded-lg border border-line px-3 py-1.5"
                      htmlFor="room-start"
                    >
                      <span className="block text-[11px] text-mute">Arrivée</span>
                      <span className="flex items-center gap-2">
                        <Icon name="calendar" className="h-4 w-4 text-mute" />
                        <input
                          id="room-start"
                          name="dateDebut"
                          type="date"
                          required
                          min={isoToday()}
                          aria-label="Date de début"
                          value={form.dateDebut}
                          onChange={(event) => updateField({ dateDebut: event.target.value })}
                          onBlur={() => handleBlur('dateDebut')}
                          className="w-full min-w-0 bg-transparent text-xs outline-none"
                          aria-invalid={Boolean(errors.dateDebut && touched.dateDebut)}
                        />
                      </span>
                    </label>

                    <label
                      className="block rounded-lg border border-line px-3 py-1.5"
                      htmlFor="room-end"
                    >
                      <span className="block text-[11px] text-mute">Départ</span>
                      <span className="flex items-center gap-2">
                        <Icon name="calendar" className="h-4 w-4 text-mute" />
                        <input
                          id="room-end"
                          type="text"
                          readOnly
                          aria-label="Date de fin"
                          placeholder="jj/mm/aaaa"
                          value={dateFin ? formatDate(`${dateFin}T00:00:00`) : ''}
                          className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-mute"
                        />
                      </span>
                    </label>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <label
                      className="flex flex-1 items-center justify-between rounded-lg border border-line bg-white px-3 py-3 text-xs font-semibold"
                      htmlFor="room-duration"
                    >
                      <span className="text-mute">Durée du séjour</span>
                      <span className="flex items-center gap-2">
                        <input
                          id="room-duration"
                          name="duree"
                          type="number"
                          min="1"
                          max={maxDuree(unite)}
                          aria-label="Durée"
                          value={duree}
                          onChange={(event) => setDuree(event.target.value)}
                          onBlur={() => handleBlur('duree')}
                          className="w-12 bg-transparent text-right text-xs font-semibold outline-none"
                          aria-invalid={Boolean(errors.duree && touched.duree)}
                        />
                        <span>{isMonthly ? 'mois' : 'nuit(s)'}</span>
                      </span>
                    </label>
                  </div>

                  {errors.dateDebut && touched.dateDebut && (
                    <p className="mt-1 text-[11px] text-red-600" role="alert">
                      {errors.dateDebut}
                    </p>
                  )}
                  {errors.duree && touched.duree && (
                    <p className="mt-1 text-[11px] text-red-600" role="alert">
                      {errors.duree}
                    </p>
                  )}

                  {dateFin && (
                    <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-slate-50 p-3 text-[11px]">
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-mute">Chambre</span>
                        <b className="text-right font-semibold">{room.title}</b>
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-mute">Séjour</span>
                        <b className="text-right font-semibold">
                          {formatDate(`${form.dateDebut}T00:00:00`)} →{' '}
                          {formatDate(`${dateFin}T00:00:00`)}
                        </b>
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-mute">Durée</span>
                        <b className="font-semibold">{pluralDuree(dureeNombre, unite)}</b>
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-mute">Total estimé</span>
                        <b className="font-semibold text-brand">
                          {priceWithCurrency(montantEstime)}
                        </b>
                      </p>
                    </div>
                  )}

                  <details
                    className="m7-collapsible mt-3 rounded-lg border border-line"
                    open={contactOpen}
                    onToggle={(event) => setContactOpen(event.currentTarget.open)}
                  >
                    <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-xs font-semibold">
                      Vos coordonnées
                      <Icon name="chevronDown" className="h-4 w-4" />
                    </summary>
                    <div className="space-y-3 border-t border-line p-3">
                      <div>
                        <label className="block text-[11px] font-semibold" htmlFor="room-name">
                          Nom complet
                        </label>
                        <input
                          id="room-name"
                          name="name"
                          type="text"
                          required
                          autoComplete="name"
                          placeholder="Votre nom complet"
                          value={form.name}
                          onChange={(event) => updateField({ name: event.target.value })}
                          onBlur={() => handleBlur('name')}
                          className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-xs outline-none focus:border-brand"
                          aria-invalid={Boolean(errors.name && touched.name)}
                        />
                        {errors.name && touched.name && (
                          <p className="mt-1 text-[11px] text-red-600" role="alert">
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold" htmlFor="room-email">
                          Email
                        </label>
                        <input
                          id="room-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="vous@exemple.com"
                          value={form.email}
                          onChange={(event) => updateField({ email: event.target.value })}
                          onBlur={() => handleBlur('email')}
                          className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-xs outline-none focus:border-brand"
                          aria-invalid={Boolean(errors.email && touched.email)}
                        />
                        {errors.email && touched.email && (
                          <p className="mt-1 text-[11px] text-red-600" role="alert">
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold" htmlFor="room-phone">
                          Téléphone <span className="font-normal text-mute">(optionnel)</span>
                        </label>
                        <input
                          id="room-phone"
                          name="phone"
                          type="tel"
                          required
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="07 00 00 00 00"
                          value={form.phone}
                          onChange={(event) => updateField({ phone: event.target.value })}
                          onBlur={() => handleBlur('phone')}
                          className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-xs outline-none focus:border-brand"
                          aria-invalid={Boolean(errors.phone && touched.phone)}
                        />
                        {errors.phone && touched.phone && (
                          <p className="mt-1 text-[11px] text-red-600" role="alert">
                            {errors.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </details>

                  {submitError && (
                    <p className="mt-3 flex items-start gap-1.5 text-[11px] text-red-600" role="alert">
                      <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-4 w-full rounded-lg bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {submitting ? 'Envoi…' : 'Réserver maintenant'}
                  </button>

                  <p className="mt-4 flex items-center gap-2 text-[11px] font-medium text-emerald-600">
                    <Icon name="shieldCheck" className="h-4 w-4 shrink-0" />
                    Annulation gratuite jusqu&apos;à 24h avant l&apos;arrivée
                  </p>
                </form>
              )}
            </section>

            {/* Hôte */}
            <section className="order-4 lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:p-5 lg:shadow-sm">
              <details open>
                <summary className="flex cursor-pointer items-center justify-between">
                  <h2 className="text-base font-bold">Votre hôte</h2>
                  <Icon name="chevronUp" className="chev h-4 w-4" />
                </summary>

                {room.gerant ? (
                  <>
                    <div className="mt-4 flex items-center gap-4">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-600 to-stone-800 text-lg font-bold text-white">
                        {`${room.gerant.prenom?.[0] ?? ''}${room.gerant.nom?.[0] ?? ''}`.toUpperCase() ||
                          'H'}
                      </span>
                      <div>
                        <p className="text-[13px] font-bold">
                          {`${room.gerant.prenom} ${room.gerant.nom}`.trim()}
                        </p>
                        <p className="text-xs text-mute">
                          {room.gerant.created_at
                            ? `Membre depuis ${memberSince(room.gerant.created_at)}`
                            : room.gerant.is_verified
                              ? 'Hôte vérifié'
                              : 'Hôte Ilehya'}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs">
                          <Icon name="star" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {gerantAvg !== null ? frenchDecimal(gerantAvg) : '—'}{' '}
                          <span className="text-mute">({gerantCount} avis)</span>
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {room.gerant.is_verified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <Icon name="check" className="h-3 w-3" />
                              Vérifié
                            </span>
                          )}
                          {isPremiumActive(room.gerant) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Icon name="star" className="h-3 w-3 fill-amber-500 text-amber-500" />
                              Premium
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {msgError && (
                      <p className="mt-3 text-[11px] text-red-600" role="alert">
                        {msgError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleContactHost}
                      disabled={msgLoading}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-brand py-2.5 text-[13px] font-bold text-brand transition hover:bg-brand-soft disabled:opacity-60"
                    >
                      <Icon name="message" className="h-4 w-4" />
                      {msgLoading ? 'Ouverture…' : "Contacter l'hôte"}
                    </button>

                    {room.gerant.phone && (
                      <a
                        href={`tel:${room.gerant.phone}`}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-[13px] font-semibold text-ink transition hover:bg-slate-50"
                      >
                        <Icon name="phone" className="h-4 w-4" />
                        {room.gerant.phone}
                      </a>
                    )}

                    <div className="mt-4 flex gap-3 rounded-xl bg-emerald-50/60 p-3">
                      <Icon name="shieldCheck" className="h-6 w-6 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-[13px] font-bold text-emerald-700">
                          {room.gerant.is_verified ? 'Logement vérifié' : 'Logement publié'}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-mute">
                          {room.gerant.is_verified
                            ? 'Ce logement a été vérifié par notre équipe pour garantir sa conformité.'
                            : 'Ce logement est proposé par un gérant de la plateforme Ilehya.'}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-[13px] text-mute">
                    Les informations de l&apos;hôte ne sont pas disponibles.
                  </p>
                )}
              </details>
            </section>
          </aside>

          {/* Description */}
          <section className="order-3 lg:col-start-1 lg:border-b lg:border-line lg:pb-8">
            <details open>
              <summary className="flex cursor-pointer items-center justify-between">
                <h2 className="text-xl font-bold">Description</h2>
                <Icon name="chevronUp" className="chev h-4 w-4" />
              </summary>
              <p
                className={`mt-4 max-w-xl whitespace-pre-line text-[13px] leading-7 text-slate-600 ${
                  descOpen ? '' : 'line-clamp-4'
                }`}
              >
                {room.description}
              </p>
              {room.description && (
                <button
                  type="button"
                  onClick={() => setDescOpen((value) => !value)}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-brand"
                >
                  {descOpen ? 'Lire moins' : 'Lire plus'}
                  <Icon
                    name="chevronDown"
                    className={`h-4 w-4 transition-transform ${descOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </details>
          </section>

          {/* Règles de la maison / conditions */}
          <section className="order-5 lg:col-start-1">
            <details open>
              <summary className="flex cursor-pointer items-center justify-between">
                <h2 className="text-xl font-bold">Règles de la maison</h2>
                <Icon name="chevronUp" className="chev h-4 w-4" />
              </summary>
              <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 rounded-xl border border-line bg-white p-5 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
                <li className="flex items-start gap-3">
                  <Icon name="clock" className="h-5 w-5 shrink-0" />
                  <span>
                    Arrivée : 14h00 – 22h00
                    <br />
                    Départ : avant 12h00
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Icon name="cigaretteOff" className="h-5 w-5 shrink-0" />
                  Non fumeur
                </li>
                <li className="flex items-center gap-3">
                  <Icon name="pawPrint" className="h-5 w-5 shrink-0" />
                  Animaux non admis
                </li>
                <li className="flex items-center gap-3">
                  <Icon name="partyPopper" className="h-5 w-5 shrink-0" />
                  Pas de fêtes ni d&apos;événements
                </li>

                {conditions.map((condition, index) => {
                  const { label, value } = conditionLabel(condition);
                  return (
                    <li key={`${condition}-${index}`} className="flex items-start gap-3">
                      <Icon name={conditionIconName(condition)} className="h-5 w-5 shrink-0" />
                      <span>
                        {label && <span className="block text-[11px] text-mute">{label}</span>}
                        {value}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>

          {/* Avis clients */}
          <section className="order-6 lg:col-start-1">
            <h2 className="text-xl font-bold">Avis des clients</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_1fr]">
              <div className="rounded-xl border border-line bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-extrabold">
                    {roomAvg !== null ? frenchDecimal(roomAvg) : '—'}
                  </span>
                  <RatingStars value={roomAvg ?? 0} className="h-5 w-5" />
                </div>
                <p className="text-xs text-mute">{roomCount} avis</p>
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    { label: '5 étoiles', width: '88%', value: '88%' },
                    { label: '4 étoiles', width: '8%', value: '8%' },
                    { label: '3 étoiles', width: '4%', value: '4%' },
                    { label: '2 étoiles', width: '0%', value: '0%' },
                    { label: '1 étoile', width: '0%', value: '0%' },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[52px_1fr_32px] items-center gap-3"
                    >
                      <span>{row.label}</span>
                      <span className="h-1.5 rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: row.width }}
                        />
                      </span>
                      <span className="text-right text-mute">{row.value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-6 text-slate-600">
                  Les avis sont publiés par les voyageurs après leur séjour.
                </p>
              </div>

              {reviews[0] && (
                <figure className="flex flex-col rounded-xl border border-line bg-white p-5">
                  <blockquote className="order-2 mt-4 text-[13px] leading-6 text-slate-600 md:order-1 md:mt-0">
                    {reviews[0].commentaire
                      ? `« ${reviews[0].commentaire} »`
                      : 'Séjour sans commentaire.'}
                  </blockquote>
                  <figcaption className="order-1 flex items-center gap-3 md:order-2 md:mt-5">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-rose-300 to-stone-800 text-sm font-bold text-white">
                      {reviews[0].client_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-xs font-bold">{reviews[0].client_name}</p>
                      <p className="text-[11px] text-mute">
                        {formatDate(reviews[0].created_at)}
                      </p>
                      <RatingStars value={reviews[0].note_appartement} />
                    </div>
                  </figcaption>
                </figure>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Tous les avis</h3>
                {reviews.length > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
                    Trier par : Plus récents
                    <Icon name="chevronDown" className="h-4 w-4" />
                  </span>
                )}
              </div>

              {reviews.length > 0 ? (
                <div className="mt-3 divide-y divide-line rounded-xl bg-white shadow-sm">
                  {reviews.map((review) => (
                    <article key={review.id} className="flex gap-3 p-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-700 to-stone-900 text-sm font-bold text-white">
                        {review.client_name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="flex-1 text-xs">
                        <p className="font-bold">{review.client_name}</p>
                        <p className="text-mute">
                          Séjour du {formatDate(review.created_at)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <RatingStars value={review.note_appartement} />
                          <span className="text-mute">
                            Appartement {review.note_appartement}/5 · Gérant{' '}
                            {review.note_gerant}/5
                          </span>
                        </div>
                        {review.commentaire && (
                          <p className="mt-1 text-slate-600">« {review.commentaire} »</p>
                        )}
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1.5 font-semibold text-sky-600"
                        >
                          <Icon name="thumbsUp" className="h-4 w-4" />
                          Utile
                        </button>
                      </div>
                      <button type="button" aria-label="Options">
                        <Icon name="moreVertical" className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-line bg-white p-5 text-[13px] text-mute">
                  Aucun avis pour le moment. Soyez le premier à partager votre expérience.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  En-tête de marché (identique à /ci)                                        */
/* -------------------------------------------------------------------------- */

function MarketHeader({ homePath, market }: { homePath: string; market: string }) {
  const navigate = useNavigate();
  const country = COUNTRIES.find((item) => item.code === market) ?? COUNTRIES[0];
  // Sur la fiche, aucun onglet n'est « actif » : ils renvoient aux sections de
  // l'accueil du marché, exactement comme la barre de /ci.
  const items = useMemo(
    () => MAQUETTE_NAV_ITEMS.map((item) => ({ ...item, active: false })),
    [],
  );

  return (
    <div className="landing maquette-shell m7-market-header">
      <LandingHeader
        country={country}
        onCountryClick={() => {}}
        onSearchClick={() => navigate(homePath, { state: { focusSearch: true } })}
        items={items}
        onItemClick={(purpose) => navigate(homePath, { state: { scrollTo: purpose } })}
        brandTo={homePath}
        account={{ to: `${homePath}/compte`, label: 'Mon espace' }}
      />
    </div>
  );
}
