import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeader from '../components/landing/LandingHeader';
import { COUNTRIES } from '../components/landing/data';
import { useMarket } from '../contexts/MarketContext';
import { useHomePath } from '../hooks/useHomePath';
import { useOfflineQueueSync } from '../hooks/useOfflineQueueSync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { fetchCategoriesByMarket, type Category } from '../data/categories';
import { fetchRoomById, type Room } from '../data/rooms';
import { MAQUETTE_NAV_ITEMS } from '../maquette/nav';
import {
  DUREE_MAX_MOIS,
  computeDateFin,
  maxDuree,
  pluralDuree,
  type DureeUnite,
} from '../lib/duration';
import { apiAuth, apiMessages, apiReviews, type RoomReviewsResponse } from '../lib/api';
import { formatDate } from '../lib/formatDate';
import { enqueue, newClientKey } from '../lib/offlineQueue';
import { isPremiumActive } from '../lib/premium';
import { addReservation } from '../lib/reservations';
import { conditionIcon, conditionLabel } from '../lib/roomConditions';
import { priceWithCurrency } from '../lib/roomDisplay';
import { initialDuree, validateForm, whatsappHref, type FormErrors } from './room-detail/roomForm';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RoomDetailPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useAuth();

  const country = COUNTRIES.find((item) => item.code === market) ?? COUNTRIES[0];
  const online = useOnlineStatus();
  useOfflineQueueSync();

  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewsData, setReviewsData] = useState<RoomReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cur, setCur] = useState(0);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState('');

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
  const [queued, setQueued] = useState(false);
  const clientKeyRef = useRef<string | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clerkSignedIn = clerkConfigured && userLoaded && Boolean(isSignedIn);

  useEffect(() => {
    document.documentElement.classList.add('room-detail-route');
    return () => document.documentElement.classList.remove('room-detail-route');
  }, []);

  useEffect(() => () => {
    if (shareTimer.current) clearTimeout(shareTimer.current);
  }, []);

  useEffect(() => {
    if (!clerkSignedIn || !user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const email =
      user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
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
  }, [id, submitted]);

  useEffect(() => {
    if (!clerkSignedIn) {
      setIsClient(false);
      return;
    }
    apiAuth
      .me()
      .then((me) => setIsClient(me.role === 'client'))
      .catch(() => setIsClient(false));
  }, [clerkSignedIn]);

  useEffect(() => {
    setCur(0);
  }, [room?.id]);

  const isMonthly = room?.priceUnit === '/ mois';
  const unite: DureeUnite = isMonthly ? 'mois' : 'nuit';

  useEffect(() => {
    if (!isMonthly) return;
    setDuree((prev) => {
      const value = Number(prev);
      if (!Number.isFinite(value) || value < 1) return '1';
      if (value <= DUREE_MAX_MOIS) return String(Math.max(1, Math.round(value / 30)));
      return String(DUREE_MAX_MOIS);
    });
  }, [isMonthly]);

  const category = room ? categories.find((item) => item.id === room.category) : null;
  const photos = room ? (room.images.length > 0 ? room.images : room.img ? [room.img] : []) : [];
  const safeCur = photos.length > 0 ? Math.min(cur, photos.length - 1) : 0;
  const subtitleText = room?.subtitle?.trim() ?? '';
  const priceText = room ? priceWithCurrency(room.price, room.priceUnit) : '';

  const dureeNombre = Number(duree);
  const dureeValide =
    Number.isInteger(dureeNombre) && dureeNombre >= 1 && dureeNombre <= maxDuree(unite);

  const effectiveDateFin =
    formData.dateDebut && dureeValide
      ? computeDateFin(formData.dateDebut, dureeNombre, unite)
      : '';

  const estimatedMontant =
    room && formData.dateDebut && dureeValide ? room.priceNum * dureeNombre : null;

  const conditions = room
    ? room.conditions
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const waHref =
    room?.gerant?.phone
      ? whatsappHref(
          room.gerant.phone,
          `Bonjour, je vous contacte au sujet de « ${room.title} » (${room.ville}${
            room.quartier ? ` — ${room.quartier}` : ''
          }) dès ${priceText}. Lien : ${window.location.href}`,
        )
      : null;

  const show = (index: number) => {
    if (photos.length === 0) return;
    setCur((index + photos.length) % photos.length);
  };

  const openSection = (purpose: string) => {
    const target = document.querySelector(`[data-purpose="${purpose}"]`);
    if (!target) {
      navigate(homePath);
      return;
    }
    const top = target.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Fallback silencieux : le lien reste copiable manuellement.
    }
    setShareFeedback(true);
    if (shareTimer.current) clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareFeedback(false), 2000);
  };

  const handleFieldChange = useCallback((patch: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const validation = validateForm(
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          dateDebut: formData.dateDebut,
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
    [formData, dureeNombre, unite],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateForm(
      {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        dateDebut: formData.dateDebut,
        duree: dureeNombre,
      },
      unite,
    );
    setErrors(validation);
    setTouched({ name: true, email: true, phone: true, dateDebut: true, duree: true });
    if (Object.keys(validation).length > 0 || !room) return;

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
      setQueued(false);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartConversation = async () => {
    if (!room || msgLoading) return;
    setMsgLoading(true);
    setMsgError('');
    try {
      const conversation = await apiMessages.getOrCreateConversation(room.id);
      navigate(`${homePath}/messages/${conversation.id}`);
    } catch {
      setMsgError("Impossible d'ouvrir la discussion. Veuillez réessayer.");
    } finally {
      setMsgLoading(false);
    }
  };

  const resetRequest = () => {
    setSubmitted(false);
    setQueued(false);
    setErrors({});
    setTouched({});
    setSubmitError('');
    clientKeyRef.current = null;
  };

  const short = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const startDate = formData.dateDebut ? new Date(`${formData.dateDebut}T00:00`) : null;
  const endDate = effectiveDateFin ? new Date(`${effectiveDateFin}T00:00`) : null;
  const validRange =
    Boolean(startDate && endDate) && !Number.isNaN(endDate?.getTime()) && dureeValide;
  const range =
    validRange && startDate && endDate
      ? `Du ${short(startDate)} au ${short(endDate)} · ${pluralDuree(dureeNombre, unite)}`
      : '';
  const total =
    estimatedMontant !== null
      ? `Estimation : ${priceWithCurrency(estimatedMontant)}`
      : 'Estimation : —';

  return (
    <div className="landing">
      <div className="maquette-shell">
        <LandingHeader
          country={country}
          onCountryClick={() => {}}
          onSearchClick={() => navigate(homePath)}
          items={MAQUETTE_NAV_ITEMS}
          onItemClick={openSection}
          brandTo={homePath}
          account={{ to: `${homePath}/compte`, label: 'Mon espace' }}
        />
        <div
          className="habici-annonce min-h-screen bg-canvas text-ink antialiased"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {/* Sprite d'icônes (style Lucide) */}
          <svg width="0" height="0" className="absolute" aria-hidden="true"><defs>
            <symbol id="i-home" viewBox="0 0 24 24"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></symbol>
            <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
            <symbol id="i-heart" viewBox="0 0 24 24"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></symbol>
            <symbol id="i-user" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></symbol>
            <symbol id="i-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
            <symbol id="i-left" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>
            <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
            <symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></symbol>
            <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
            <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></symbol>
            <symbol id="i-file" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/></symbol>
            <symbol id="i-list" viewBox="0 0 24 24"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/></symbol>
            <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
            <symbol id="i-shield" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></symbol>
            <symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></symbol>
            <symbol id="i-paw" viewBox="0 0 24 24"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.8 1Q6.5 17.5 4.5 16.8A3.5 3.5 0 0 1 5.5 10z"/></symbol>
            <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1z"/></symbol>
            <symbol id="i-msg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
            <symbol id="i-wa" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></symbol>
            <symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></symbol>
            <symbol id="i-cal" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
            <symbol id="i-send" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></symbol>
            <symbol id="i-lock" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
            <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></symbol>
          </defs></svg>

          {loading ? (
            <main className="max-w-[1200px] mx-auto px-3 pt-5">
              <p className="card p-6 text-muted">Chargement...</p>
            </main>
          ) : !room ? (
            <main className="max-w-[1200px] mx-auto px-3 pt-5">
              <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <Link to={homePath} className="hover:text-brand">Accueil</Link>
                <svg className="ic w-3.5 h-3.5"><use href="#i-right"/></svg>
                <span aria-current="page">Chambre introuvable</span>
              </nav>
              <p className="card mt-4 p-6 text-muted">Chambre introuvable.</p>
              <Link to={homePath} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand text-white text-sm font-semibold">
                <svg className="ic w-4 h-4"><use href="#i-back"/></svg>Retour à l&apos;accueil
              </Link>
            </main>
          ) : (
            <main className="max-w-[1200px] mx-auto px-3 pt-5">
              {/* Fil d'Ariane */}
              <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <Link to={homePath} className="hover:text-brand">Accueil</Link>
                <svg className="ic w-3.5 h-3.5"><use href="#i-right"/></svg>
                {category && (
                  <>
                    <Link to={`${homePath}/categorie/${category.id}`} className="hover:text-brand">{category.title}</Link>
                    <svg className="ic w-3.5 h-3.5"><use href="#i-right"/></svg>
                  </>
                )}
                <span aria-current="page">{room.title}</span>
              </nav>

              {/* Retour / Partager */}
              <div className="relative mt-3 flex items-center justify-between">
                <Link to={homePath} className="card inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold">
                  <svg className="ic w-4 h-4"><use href="#i-back"/></svg>Retour
                </Link>
                <button type="button" onClick={handleShare} className="card inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold">
                  <svg className="ic w-4 h-4"><use href="#i-share"/></svg>Partager
                </button>
                <span className={`${shareFeedback ? 'inline-flex' : 'hidden'} absolute right-0 top-9 z-10 items-center gap-1 rounded-lg bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 shadow`}>
                  <svg className="ic w-3.5 h-3.5"><use href="#i-check"/></svg>Lien copié !
                </span>
              </div>

              <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
                {/* Colonne gauche */}
                <article className="card min-w-0 p-3 sm:p-4 space-y-6">
                  {/* Galerie */}
                  <section aria-label="Photos du bien">
                    <div className="relative aspect-[4/3] sm:aspect-[2.3/1] overflow-hidden rounded-2xl bg-slate-200">
                      {photos.length > 0 ? (
                        <>
                          <img
                            src={photos[safeCur]}
                            alt={`${room.title} — photo ${safeCur + 1} sur ${photos.length}`}
                            className="w-full h-full object-cover"
                          />
                          <button type="button" onClick={() => show(safeCur - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-white/90 shadow" aria-label="Photo précédente"><svg className="ic w-5 h-5"><use href="#i-left"/></svg></button>
                          <button type="button" onClick={() => show(safeCur + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-white/90 shadow" aria-label="Photo suivante"><svg className="ic w-5 h-5"><use href="#i-right"/></svg></button>
                          <span className="absolute bottom-3 right-3 rounded-lg bg-black/60 text-white text-xs font-medium px-2.5 py-1">Photo {safeCur + 1} sur {photos.length}</span>
                        </>
                      ) : (
                        <div className="grid h-full place-items-center text-sm text-muted">Aucune photo disponible.</div>
                      )}
                    </div>
                    {photos.length > 0 && (
                      <div className="mt-2 grid grid-cols-6 gap-2">
                        {photos.map((photo, index) => (
                          <button
                            key={`${photo}-${index}`}
                            type="button"
                            onClick={() => show(index)}
                            className={`min-w-0 aspect-[8/5] overflow-hidden rounded-lg ring-offset-2 ring-brand ${index === safeCur ? 'ring-2 is-active' : ''}`}
                            aria-label={`Voir la photo ${index + 1}`}
                          >
                            <img src={photo} alt={`${room.title} — aperçu ${index + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Titre + prix */}
                  <section className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {category && <span className="inline-block rounded-md bg-brand-100 text-brand text-xs font-semibold px-2.5 py-1">{category.title}</span>}
                        {room.info && <span className="inline-block rounded-md bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1">{room.info}</span>}
                      </div>
                      <h1 className="mt-2 text-xl sm:text-2xl font-extrabold leading-tight">{room.title}</h1>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                        <svg className="ic w-4 h-4"><use href="#i-pin"/></svg>
                        {[room.quartier, room.ville].filter(Boolean).join(', ')}
                        {room.chambres > 0 && <><span>·</span>{room.chambres} chambre{room.chambres > 1 ? 's' : ''}</>}
                        {room.douches > 0 && <><span>·</span>{room.douches} salle{room.douches > 1 ? 's' : ''} d’eau</>}
                      </p>
                      {subtitleText && <p className="mt-1 text-sm text-muted">{subtitleText}</p>}
                    </div>
                    <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand">dès <b className="text-lg font-extrabold">{priceText}</b> {room.priceUnit}</p>
                  </section>

                  {/* Description */}
                  {room.description && (
                    <section>
                      <h2 className="sec-title"><span className="sec-ico"><svg className="ic w-4 h-4"><use href="#i-file"/></svg></span>Description</h2>
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{room.description}</p>
                    </section>
                  )}

                  {/* Conditions */}
                  {conditions.length > 0 && (
                    <section>
                      <h2 className="sec-title"><span className="sec-ico"><svg className="ic w-4 h-4"><use href="#i-list"/></svg></span>Conditions de réservation</h2>
                      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-4 text-sm">
                        {conditions.map((condition, index) => {
                          const { label, value } = conditionLabel(condition);
                          return (
                            <li key={`${condition}-${index}`} className="flex items-center gap-3 lg:border-r border-line pr-2 last:border-r-0">
                              <svg className="ic w-5 h-5 text-muted shrink-0"><use href={`#${conditionIcon(condition)}`}/></svg>
                              {label ? (
                                <span><span className="block text-muted">{label}</span><b className="font-medium">{value}</b></span>
                              ) : (
                                <b className="font-medium">{value}</b>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {/* Hôte */}
                  {room.gerant && (
                    <section className="rounded-2xl bg-navy text-white p-4 flex flex-wrap items-center gap-4">
                      <span className="grid place-items-center w-16 h-16 rounded-full bg-white/15 text-xl font-bold ring-2 ring-white/25" aria-hidden="true">
                        {`${room.gerant.prenom?.[0] ?? ''}${room.gerant.nom?.[0] ?? ''}`.toUpperCase() || 'H'}
                      </span>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold">{`${room.gerant.prenom} ${room.gerant.nom}`.trim()}</h2>
                          {room.gerant.is_verified && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/15 text-emerald-300 text-xs px-2 py-0.5"><svg className="ic w-3 h-3"><use href="#i-check"/></svg>Vérifié</span>
                          )}
                          {isPremiumActive(room.gerant) && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/15 text-amber-300 text-xs px-2 py-0.5"><svg className="ic w-3 h-3 fill-amber-300"><use href="#i-star"/></svg>Premium</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm text-white/80">
                          {room.gerant.is_verified ? 'Gérant vérifié sur Linkhoo' : 'Gérant sur Linkhoo'}
                        </p>
                        {msgError && <p className="mt-1 text-xs text-red-300" role="alert">{msgError}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isClient && (
                          <button type="button" onClick={handleStartConversation} disabled={msgLoading} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#2F7DF6] hover:bg-blue-600 text-sm font-semibold disabled:opacity-60">
                            <svg className="ic w-4 h-4"><use href="#i-msg"/></svg>{msgLoading ? 'Ouverture...' : 'Message'}
                          </button>
                        )}
                        {room.gerant.phone && (
                          <a href={`tel:${room.gerant.phone}`} className="grid place-items-center w-11 h-11 rounded-xl border border-white/80 hover:bg-white/10" aria-label={`Appeler ${room.gerant.phone}`} title={room.gerant.phone}><svg className="ic w-5 h-5"><use href="#i-phone"/></svg></a>
                        )}
                        {waHref && (
                          <a href={waHref} target="_blank" rel="noopener noreferrer" className="grid place-items-center w-11 h-11 rounded-xl bg-[#22C55E] hover:bg-green-600" aria-label="Discuter sur WhatsApp"><svg className="ic w-5 h-5"><use href="#i-wa"/></svg></a>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Avis */}
                  {reviewsData && reviewsData.reviews.length > 0 && (
                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="sec-title"><svg className="ic w-5 h-5 text-brand"><use href="#i-star"/></svg>Avis des locataires</h2>
                        <p className="room-reviews__summary flex flex-wrap items-center gap-5 text-sm">
                          {reviewsData.room_avg !== null && (
                            <span className="flex items-center gap-1.5">Note globale <svg className="ic w-4 h-4 fill-amber-400 stroke-amber-400"><use href="#i-star"/></svg><b className="text-amber-600">{reviewsData.room_avg.toFixed(1)}</b><span className="text-muted">({reviewsData.room_count})</span></span>
                          )}
                          {reviewsData.gerant_avg !== null && (
                            <span className="flex items-center gap-1.5">Gérant <svg className="ic w-4 h-4 fill-amber-400 stroke-amber-400"><use href="#i-star"/></svg><b className="text-amber-600">{reviewsData.gerant_avg.toFixed(1)}</b><span className="text-muted">({reviewsData.gerant_count})</span></span>
                          )}
                        </p>
                      </div>
                      <ul className="mt-4 space-y-3">
                        {reviewsData.reviews.map((review) => (
                          <li key={review.id} className="rounded-xl border border-line p-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                              <span className="grid place-items-center w-12 h-12 rounded-full bg-brand-50 text-brand font-bold" aria-hidden="true">
                                {review.client_name.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <p className="font-bold">{review.client_name}</p>
                                <p className="text-xs text-muted">{formatDate(review.created_at)}</p>
                                {review.commentaire && <p className="mt-1 text-sm text-muted">« {review.commentaire} »</p>}
                              </div>
                            </div>
                            <p className="flex items-center gap-6 text-sm text-muted sm:pl-6 sm:border-l border-line">
                              <span className="flex items-center gap-1.5">Appartement <svg className="ic w-4 h-4 fill-amber-400 stroke-amber-400"><use href="#i-star"/></svg><b className="text-ink font-medium">{review.note_appartement}/5</b></span>
                              <span className="flex items-center gap-1.5">Gérant <svg className="ic w-4 h-4 fill-amber-400 stroke-amber-400"><use href="#i-star"/></svg><b className="text-ink font-medium">{review.note_gerant}/5</b></span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </article>

                {/* Colonne droite : réservation */}
                <aside className="card min-w-0 p-5 lg:sticky lg:top-4">
                  <h2 className="text-lg font-extrabold">Demande de réservation</h2>

                  {submitted ? (
                    <div className="text-center py-8" role="status">
                      <span className="mx-auto grid place-items-center w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600"><svg className="ic w-8 h-8"><use href="#i-check"/></svg></span>
                      <h3 className="mt-4 text-lg font-bold">{queued ? 'Demande enregistrée hors-ligne' : 'Demande envoyée !'}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {queued
                          ? 'Elle sera envoyée automatiquement dès le retour de la connexion.'
                          : 'Votre demande a bien été envoyée. Nous vous recontacterons rapidement.'}
                      </p>
                      <Link
                        to={clerkSignedIn ? `${homePath}/compte` : `${homePath}/suivi-reservation`}
                        className="mt-4 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand text-white text-sm font-semibold"
                      >
                        Suivre ma réservation
                      </Link>
                      <button type="button" onClick={resetRequest} className="mt-3 block mx-auto h-10 px-4 rounded-xl border border-brand text-brand font-semibold">
                        Retourner à l&apos;annonce
                      </button>
                    </div>
                  ) : (
                    <div>
                      {!online && (
                        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
                          Vous êtes hors-ligne : votre demande sera enregistrée puis envoyée au retour de la connexion.
                        </p>
                      )}

                      {!clerkSignedIn && (
                        <>
                          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm">
                            <p className="flex items-center gap-2 font-semibold">
                              <span className="grid place-items-center w-9 h-9 rounded-full bg-sky-100 text-[#2F7DF6] shrink-0"><svg className="ic w-5 h-5 fill-current"><use href="#i-user"/></svg></span>
                              Connectez-vous pour pré-remplir vos infos
                            </p>
                            <p className="mt-1 text-muted">Gagnez du temps : vos coordonnées seront remplies automatiquement.</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Link to={`${homePath}/login`} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold"><svg className="ic w-4 h-4"><use href="#i-user"/></svg>Se connecter</Link>
                              <Link to={`${homePath}/inscription`} className="inline-flex items-center justify-center h-10 rounded-xl border border-brand text-brand bg-white font-semibold">Créer un compte</Link>
                            </div>
                          </div>
                        </>
                      )}

                      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
                        <div>
                          <label className="lbl" htmlFor="name">Nom complet <span className="text-brand">*</span></label>
                          <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            autoComplete="name"
                            placeholder="Votre nom complet"
                            className="field w-full"
                            aria-invalid={Boolean(errors.name && touched.name)}
                            value={formData.name}
                            onChange={(event) => handleFieldChange({ name: event.target.value })}
                            onBlur={() => handleBlur('name')}
                          />
                          {errors.name && touched.name && <p className="err" role="alert"><svg className="ic w-3.5 h-3.5"><use href="#i-alert"/></svg>{errors.name}</p>}
                        </div>
                        <div>
                          <label className="lbl" htmlFor="email">Email <span className="text-brand">*</span></label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="vous@exemple.com"
                            className="field w-full"
                            aria-invalid={Boolean(errors.email && touched.email)}
                            value={formData.email}
                            onChange={(event) => handleFieldChange({ email: event.target.value })}
                            onBlur={() => handleBlur('email')}
                          />
                          {errors.email && touched.email && <p className="err" role="alert"><svg className="ic w-3.5 h-3.5"><use href="#i-alert"/></svg>{errors.email}</p>}
                        </div>
                        <div>
                          <label className="lbl" htmlFor="phone">Téléphone <span className="text-brand">*</span></label>
                          <div className="relative">
                            <svg className="ic w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted"><use href="#i-phone"/></svg>
                            <input
                              id="phone"
                              name="phone"
                              type="tel"
                              required
                              autoComplete="tel"
                              inputMode="tel"
                              placeholder="01 23 45 67"
                              className="field w-full pl-9"
                              aria-invalid={Boolean(errors.phone && touched.phone)}
                              value={formData.phone}
                              onChange={(event) => handleFieldChange({ phone: event.target.value })}
                              onBlur={() => handleBlur('phone')}
                            />
                          </div>
                          {errors.phone && touched.phone && <p className="err" role="alert"><svg className="ic w-3.5 h-3.5"><use href="#i-alert"/></svg>{errors.phone}</p>}
                        </div>

                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <div>
                            <label className="lbl" htmlFor="start">Date de début <span className="text-brand">*</span></label>
                            <div className="relative">
                              <svg className="ic w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><use href="#i-cal"/></svg>
                              <input
                                id="start"
                                name="start"
                                type="date"
                                required
                                min={isoToday()}
                                className="field w-full pl-9"
                                aria-invalid={Boolean(errors.dateDebut && touched.dateDebut)}
                                value={formData.dateDebut}
                                onChange={(event) => handleFieldChange({ dateDebut: event.target.value })}
                                onBlur={() => handleBlur('dateDebut')}
                              />
                            </div>
                            {errors.dateDebut && touched.dateDebut && <p className="err" role="alert"><svg className="ic w-3.5 h-3.5"><use href="#i-alert"/></svg>{errors.dateDebut}</p>}
                          </div>
                          <div>
                            <label className="lbl" htmlFor="dur">Durée <span className="text-brand">*</span></label>
                            <div className="flex gap-2">
                              <input
                                id="dur"
                                name="dur"
                                type="number"
                                min="1"
                                max={maxDuree(unite)}
                                value={duree}
                                onChange={(event) => setDuree(event.target.value)}
                                onBlur={() => handleBlur('duree')}
                                className="field w-16 px-2 text-center"
                                aria-invalid={Boolean(errors.duree && touched.duree)}
                              />
                              <span className="field w-28 grid place-items-center text-sm text-muted">
                                {unite === 'mois' ? 'Mois' : 'Nuit(s)'}
                              </span>
                            </div>
                            {errors.duree && touched.duree && <p className="err" role="alert"><svg className="ic w-3.5 h-3.5"><use href="#i-alert"/></svg>{errors.duree}</p>}
                          </div>
                        </div>

                        <div>
                          <label className="lbl text-muted font-medium" htmlFor="end">Date de fin (calculée)</label>
                          <div className="relative">
                            <svg className="ic w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted"><use href="#i-cal"/></svg>
                            <input id="end" readOnly className="field w-full pl-9 bg-canvas" value={effectiveDateFin} />
                          </div>
                        </div>

                        <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">
                          <svg className="ic w-5 h-5 text-brand shrink-0"><use href="#i-alert"/></svg>
                          <div>
                            <p className="font-medium">{range || 'Sélectionnez une date de début.'}</p>
                            <p className="text-muted">{total}</p>
                          </div>
                        </div>

                        {submitError && <p className="err" role="alert"><svg className="ic w-3.5 h-3.5"><use href="#i-alert"/></svg>{submitError}</p>}

                        <button type="submit" disabled={submitting} className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold shadow-md shadow-brand/25 disabled:opacity-60">
                          <svg className="ic w-5 h-5"><use href="#i-send"/></svg>{submitting ? 'Envoi...' : 'Envoyer la demande'}
                        </button>
                        <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><svg className="ic w-3.5 h-3.5"><use href="#i-lock"/></svg>Vos informations sont sécurisées</p>
                      </form>
                    </div>
                  )}
                </aside>
              </div>
            </main>
          )}
        </div>
      </div>
      <LandingFooter />
    </div>
  );
}
