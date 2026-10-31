import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import {
  setAuthTokenGetter,
  apiReviews,
  type ClientMineReservationData,
  type ReviewData,
  type RoomReviewsResponse,
} from '../lib/api';
import { getMyReservations } from '../lib/reservations';
import { fetchRoomById, type Room } from '../data/rooms';
import { priceWithCurrency } from '../lib/roomDisplay';
import LandingFooter from '../components/landing/LandingFooter';

// Icône inline (lucide) fidèle à la maquette.
function Ic({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Stars({ value, size = 'w-4 h-4' }: { value: number; size?: string }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className={`flex ${size}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className={`w-full h-full ${i < full || (i === full && half) ? 'fill-[#FF6A13] text-[#FF6A13]' : 'fill-[#E2E8F0] text-[#E2E8F0]'}`} viewBox="0 0 24 24">
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      ))}
    </span>
  );
}

const STAR_PATH = 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

function ReviewPhotos({ photos }: { photos: string[] }) {
  const list = photos.slice(0, 3);
  if (list.length === 0) return null;
  return (
    <div className="mt-3 flex gap-2" role="group" aria-label="Photos de la réservation">
      {list.map((src, index) => (
        <a
          key={`${src}-${index}`}
          href={src}
          target="_blank"
          rel="noreferrer"
          className="block h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
        >
          <img
            src={src}
            alt={`Photo ${index + 1} de la réservation`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </a>
      ))}
      {photos.length > 3 && (
        <span className="grid h-16 w-20 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
          +{photos.length - 3}
        </span>
      )}
    </div>
  );
}

function frenchDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function reviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StarPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex gap-1" role="group" aria-label={`Note pour ${label.toLowerCase()}`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} étoile${n > 1 ? 's' : ''} — ${label}`}
              aria-pressed={n <= value}
              className="text-2xl leading-none transition-colors"
              style={{ color: n <= value ? '#FF6A13' : '#E2E8F0' }}
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-sm font-semibold">{value}/5</span>
      </div>
    </div>
  );
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200';

export default function LaisserAvisPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const homePath = useHomePath();
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();

  const [reservation, setReservation] = useState<ClientMineReservationData | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [reviewsData, setReviewsData] = useState<RoomReviewsResponse | null>(null);
  const [myReview, setMyReview] = useState<ReviewData | null>(null);
  const [mineUnavailable, setMineUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cur, setCur] = useState(0);
  const [filter, setFilter] = useState(0);
  const [sortIdx, setSortIdx] = useState(0);

  const [noteAppartement, setNoteAppartement] = useState(5);
  const [noteGerant, setNoteGerant] = useState(5);
  const [commentaire, setCommentaire] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const redirectTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    },
    [],
  );

  const staysPath = `${homePath}/compte?view=stays`;
  const searchPath = `${homePath}/recherche`;
  const messagesPath = `${homePath}/messages`;
  const favoritesPath = `${homePath}/compte?view=favorites`;
  const profilePath = `${homePath}/compte?view=profile`;

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.fullName || 'Mon compte';

  // La police « Plus Jakarta Sans » est auto-hébergée (src/fonts.css) :
  // aucune requête vers Google Fonts, contrairement à la maquette statique.

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !reservationId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const [reservations, mine] = await Promise.all([
          getMyReservations(),
          apiReviews
            .listMine()
            .then((loaded) => ({ loaded, ok: true }))
            .catch(() => ({ loaded: [] as ReviewData[], ok: false })),
        ]);
        if (cancelled) return;

        const found = reservations.find((item) => item.id === reservationId) ?? null;
        setReservation(found);
        if (!found) {
          setError('Réservation introuvable.');
          return;
        }

        setMineUnavailable(!mine.ok);
        setMyReview(
          mine.ok
            ? mine.loaded.find((review) => review.reservation_id === found.id) ?? null
            : null,
        );

        if (!found.room_id) return;

        const [roomInfo, roomReviews] = await Promise.all([
          fetchRoomById(found.room_id).catch(() => null),
          apiReviews.listByRoom(found.room_id).catch(() => null),
        ]);
        if (cancelled) return;
        if (roomInfo) setRoom(roomInfo);
        setReviewsData(roomReviews);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les données de la réservation ou des avis.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, reservationId]);

  const title = room?.title || reservation?.room_title || 'Chambre à louer';
  const location = room ? [room.quartier, room.ville].filter(Boolean).join(', ') : '';

  const reservationPhotos = useMemo(() => {
    const list = [
      ...(room?.images ?? []),
      room?.img,
      reservation?.room?.img,
    ].filter((src): src is string => Boolean(src && src.trim()));
    return Array.from(new Set(list));
  }, [room, reservation]);

  const photos = reservationPhotos.length > 0 ? reservationPhotos : [PLACEHOLDER_IMAGE];

  const safeCur = Math.min(cur, photos.length - 1);

  const show = (i: number) => setCur((i + photos.length) % photos.length);

  const roomAvg = reviewsData?.room_avg ?? null;
  const roomCount = reviewsData?.room_count ?? reviewsData?.reviews.length ?? 0;
  const gerantAvg = reviewsData?.gerant_avg ?? null;
  const distribution = reviewsData?.room_distribution ?? [];

  const criteria = useMemo(() => {
    const rows: { label: string; value: number }[] = [];
    if (roomAvg !== null) rows.push({ label: 'Logement', value: roomAvg });
    if (gerantAvg !== null) rows.push({ label: 'Gérant', value: gerantAvg });
    return rows;
  }, [roomAvg, gerantAvg]);

  const roomReviews = reviewsData?.reviews ?? [];

  const filteredReviews = useMemo(() => {
    const list =
      filter === 3
        ? roomReviews.filter((review) => review.note_appartement === 5)
        : [...roomReviews];
    return list.sort((a, b) => {
      if (sortIdx === 1) {
        const byNote = b.note_appartement - a.note_appartement;
        if (byNote !== 0) return byNote;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [roomReviews, filter, sortIdx]);

  const isConfirmed = reservation?.statut === 'confirmee';
  const hasRoom = Boolean(reservation?.room_id);
  const canReview = Boolean(reservation) && isConfirmed && hasRoom && !myReview;

  const blockedReason = !reservation || myReview
    ? ''
    : !isConfirmed
      ? reservation.statut === 'annulee'
        ? 'Cette réservation a été annulée : vous ne pouvez pas laisser d’avis.'
        : 'Vous pourrez laisser un avis dès que votre réservation sera confirmée.'
      : !hasRoom
        ? 'Le logement lié à cette réservation n’est plus disponible : impossible de publier un avis.'
        : '';

  const refreshRoomReviews = async (roomId: string) => {
    const refreshed = await apiReviews.listByRoom(roomId).catch(() => null);
    if (refreshed) setReviewsData(refreshed);
  };

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!reservation || sending || success || !canReview) return;

    const text = commentaire.trim();
    setError('');
    setFormMsg('');
    if (text.length < 10) {
      setFormMsg('Écrivez au moins 10 caractères pour publier votre avis.');
      return;
    }

    setSending(true);
    try {
      const created = await apiReviews.create({
        reservation_id: reservation.id,
        note_appartement: noteAppartement,
        note_gerant: noteGerant,
        commentaire: text,
      });
      setMyReview(created);
      setSuccess(true);
      setFormMsg('Merci ! Votre avis a bien été publié.');

      // Affichage immédiat, puis agrégats recalculés par le backend.
      setReviewsData((prev) =>
        prev ? { ...prev, reviews: [created, ...prev.reviews] } : prev,
      );
      if (reservation.room_id) {
        void refreshRoomReviews(reservation.room_id);
      }

      redirectTimer.current = window.setTimeout(() => navigate(staysPath), 1800);
    } catch (err) {
      setFormMsg('');
      setError(err instanceof Error ? err.message : 'Impossible de publier l’avis.');
    } finally {
      setSending(false);
    }
  };

  const reviewFormBody = (showTips: boolean) => (
    <>
      <div className="grid gap-3 mt-4 sm:grid-cols-2">
        <StarPicker label="Logement" value={noteAppartement} onChange={setNoteAppartement} />
        <StarPicker label="Gérant" value={noteGerant} onChange={setNoteGerant} />
      </div>
      <div className="relative mt-4">
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Partagez votre expérience : qu’avez-vous aimé ? Qu’est-ce qui pourrait être amélioré ?"
          className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A13]/40"
        />
        <span className="absolute bottom-3 right-4 text-xs text-slate-400">
          {commentaire.length}/2000
        </span>
      </div>
      {showTips && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs text-slate-600">
          <p className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5">
            <Ic d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" className="text-[#FF6A13] shrink-0 w-4 h-4" />
            Votre avis est authentique
          </p>
          <p className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5">
            <Ic d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76m6 3.38 2 2 4-4" className="text-[#FF6A13] shrink-0 w-4 h-4" />
            Publié immédiatement
          </p>
          <p className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5">
            <Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="text-[#FF6A13] shrink-0 w-4 h-4" />
            Cela aide la communauté
          </p>
        </div>
      )}

      {mineUnavailable && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700" role="status">
          Impossible de vérifier si vous avez déjà laissé un avis. Vous pouvez essayer de
          publier : le serveur refusera automatiquement les doublons.
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]" role="status">
          {formMsg}
        </p>
      )}
      {!success && formMsg && (
        <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]" role="status">
          {formMsg}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={sending || success}
        onClick={handleSubmit}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] hover:bg-orange-600 transition text-white font-semibold py-3.5 disabled:opacity-60"
      >
        <Ic d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" className="w-5 h-5" />
        {sending ? 'Publication…' : 'Publier mon avis'}
      </button>
    </>
  );

  const priceText = room
    ? priceWithCurrency(room.price, room.priceUnit)
    : reservation?.montant != null
      ? `${reservation.montant.toLocaleString('fr-FR')} FCFA`
      : '—';
  const priceUnit = room?.priceUnit ?? '';
  const priceLabel = room ? 'À partir de' : 'Montant du séjour';
  const roomDetailPath = reservation?.room_id
    ? `${homePath}/chambre/${reservation.room_id}`
    : staysPath;

  if (loading) {
    return (
      <div className="linkhoo-avis min-h-screen bg-[#FAFAFA] antialiased" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <p className="text-sm text-slate-500">Chargement…</p>
        </main>
      </div>
    );
  }
  if (error && !reservation) {
    return (
      <div className="linkhoo-avis min-h-screen bg-[#FAFAFA] antialiased" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <p className="text-sm text-red-600" role="alert">{error}</p>
          <button type="button" onClick={() => navigate(staysPath)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FF6A13] px-4 py-2.5 text-sm font-semibold text-white">
            Retour à mes réservations
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="linkhoo-avis min-h-screen bg-[#FAFAFA] text-[#1B2A4A] antialiased" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 lg:h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(-1)} className="lg:hidden p-1 -ml-1" aria-label="Retour">
              <Ic d="m15 18-6-6 6-6" className="w-6 h-6" />
            </button>
            <Link to={homePath} className="flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#FF6A13] text-white">
                <Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-5 h-5" />
              </span>
              <span className="leading-none">
                <span className="block text-2xl font-extrabold tracking-tight">Link<span className="text-[#FF6A13]">hoo</span></span>
                <span className="hidden lg:block text-[11px] text-slate-500 mt-0.5">Des logements, des histoires</span>
              </span>
            </Link>
          </div>
          <nav className="hidden lg:flex items-center gap-9 text-sm font-medium">
            <Link to={homePath} className="flex items-center gap-2"><Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-4 h-4" />Accueil</Link>
            <Link to={searchPath} className="flex items-center gap-2"><Ic d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" className="w-4 h-4" />Rechercher</Link>
            <Link to={favoritesPath} className="flex items-center gap-2"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-4 h-4" />Favoris</Link>
            <Link to={messagesPath} className="flex items-center gap-2"><Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className="w-4 h-4" />Messages</Link>
          </nav>
          <div className="hidden lg:flex items-center gap-6">
            <Link to={messagesPath} className="relative" aria-label="Messages">
              <Ic d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" className="w-5 h-5" />
            </Link>
            <Link to={profilePath} className="flex items-center gap-2 text-sm font-medium">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-[#1B2A4A]" />
              ) : (
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[#1B2A4A] text-white text-sm font-semibold">
                  {fullName.charAt(0).toUpperCase()}
                </span>
              )}
              {fullName} <Ic d="m6 9 6 6 6-6" className="w-4 h-4" />
            </Link>
          </div>
          <div className="lg:hidden flex items-center gap-4">
            <Link to={favoritesPath} aria-label="Favoris"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-6 h-6" /></Link>
            <Link to={messagesPath} aria-label="Messages"><Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className="w-6 h-6" /></Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto lg:px-8 pb-40 lg:pb-0">
        {/* Fil d'Ariane */}
        <nav className="hidden lg:flex items-center gap-2 text-sm py-4">
          <Link to={homePath} className="hover:text-[#FF6A13]">Accueil</Link>
          <Ic d="m9 18 6-6-6-6" className="w-4 h-4 text-slate-400" />
          {room?.quartier ? (
            <>
              <span>{room.quartier}</span>
              <Ic d="m9 18 6-6-6-6" className="w-4 h-4 text-slate-400" />
            </>
          ) : null}
          <span className="text-slate-600">{title}</span>
        </nav>

        {/* FICHE LOGEMENT */}
        <section className="bg-white lg:rounded-2xl lg:shadow-sm lg:p-5 lg:grid lg:grid-cols-[1.5fr_1.1fr_.9fr] lg:gap-6">
          <div className="flex gap-3">
            <div className="relative flex-1 h-56 sm:h-72 lg:h-72 lg:rounded-xl overflow-hidden bg-slate-200">
              <img src={photos[safeCur]} className="w-full h-full object-cover" alt={title} />
              {photos.length > 1 && (
                <>
                  <button onClick={() => show(cur - 1)} className="hidden lg:grid absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 place-items-center rounded-full bg-white shadow" aria-label="Précédent">
                    <Ic d="m15 18-6-6 6-6" className="w-5 h-5" />
                  </button>
                  <button onClick={() => show(cur + 1)} className="hidden lg:grid absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 place-items-center rounded-full bg-white shadow" aria-label="Suivant">
                    <Ic d="m9 18 6-6-6-6" className="w-5 h-5" />
                  </button>
                </>
              )}
              <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-[#1B2A4A]/70 text-white text-xs font-semibold px-2.5 py-1.5">
                {safeCur + 1}/{photos.length}
              </span>
            </div>
            {photos.length > 1 && (
              <div className="hidden lg:flex flex-col gap-3 w-24">
                {[0, 1, 2].map((k) => {
                  const j = (safeCur + k) % photos.length;
                  return (
                    <button key={k} onClick={() => setCur(j)} className={`h-[5.5rem] rounded-lg overflow-hidden border-2 ${k === 0 ? 'border-[#FF6A13]' : 'border-transparent'}`}>
                      <img src={photos[j]} className="w-full h-full object-cover" alt="" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative -mt-5 lg:mt-0 rounded-t-3xl lg:rounded-none bg-white p-4 lg:p-0">
            {room?.category && (
              <span className="hidden lg:inline-block rounded-full bg-[#FFF3EB] text-[#FF6A13] text-xs font-semibold px-3 py-1">
                {room.category.charAt(0).toUpperCase() + room.category.slice(1)}
              </span>
            )}
            <div className="flex items-start justify-between gap-3 lg:mt-3">
              <div>
                <h1 className="text-xl lg:text-2xl font-extrabold">{title}</h1>
                {location && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-600 mt-2">
                    <Ic d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" className="w-4 h-4 text-[#FF6A13]" />
                    {location}
                  </p>
                )}
                <p className="flex items-center gap-2 mt-2 text-sm">
                  <Stars value={roomAvg ?? 0} />
                  <b>{roomAvg !== null ? frenchDecimal(roomAvg) : '—'}</b>
                  <span className="text-slate-500">({roomCount} avis)</span>
                </p>
              </div>
              <div className="lg:hidden shrink-0 rounded-xl bg-[#FFF3EB] px-3 py-2.5">
                <p className="text-xs text-slate-600">{priceLabel}</p>
                <p className="font-extrabold whitespace-nowrap">
                  {priceText} {priceUnit && <span className="text-xs font-normal">{priceUnit}</span>}
                </p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-slate-600">
              {room?.chambres ? (
                <li className="flex items-center gap-1.5">
                  <Ic d="M2 20.5A4 4 0 0 1 8 17h2a4 4 0 0 1 6 3.5M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-4 h-4" />
                  {room.chambres} chambre{room.chambres > 1 ? 's' : ''}
                </li>
              ) : null}
              {room?.douches ? (
                <li className="flex items-center gap-1.5">
                  <Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-4 h-4" />
                  {room.douches} douche{room.douches > 1 ? 's' : ''}
                </li>
              ) : null}
              {room?.ville ? (
                <li className="flex items-center gap-1.5">
                  <Ic d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" className="w-4 h-4" />
                  {room.ville}
                </li>
              ) : null}
              {room?.category ? (
                <li className="flex items-center gap-1.5">
                  <Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-4 h-4" />
                  {room.category.charAt(0).toUpperCase() + room.category.slice(1)}
                </li>
              ) : null}
            </ul>
          </div>

          <aside className="hidden lg:block self-start rounded-2xl bg-[#FFF3EB] border border-orange-100 p-5">
            <p className="text-sm text-slate-600">{priceLabel}</p>
            <p className="text-3xl font-extrabold mt-1">
              {priceText} {priceUnit && <span className="text-base font-medium">{priceUnit}</span>}
            </p>
            <Link to={roomDetailPath} className="mt-5 w-full flex items-center justify-between rounded-xl bg-[#FF6A13] hover:bg-orange-600 transition text-white font-semibold px-5 py-3.5">
              <span className="flex-1 text-center">Voir le logement</span>
              <Ic d="m9 18 6-6-6-6" className="w-5 h-5" />
            </Link>
          </aside>
        </section>

        {/* Onglets mobile */}
        <nav className="lg:hidden flex gap-7 overflow-x-auto no-scrollbar px-5 border-b border-slate-100 bg-white text-[15px]">
          <Link to={roomDetailPath} className="py-4 text-slate-600">Description</Link>
          <Link to={roomDetailPath} className="py-4 text-slate-600">Équipements</Link>
          <span className="py-4 text-[#FF6A13] font-semibold border-b-2 border-[#FF6A13]">Avis</span>
          <Link to={roomDetailPath} className="py-4 text-slate-600">Localisation</Link>
        </nav>

        {/* AVIS */}
        <div className="px-4 lg:px-0 mt-4 lg:mt-5 grid lg:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">
            {/* Résumé */}
            <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg lg:text-xl font-bold">Avis des voyageurs</h2>
                  <p className="hidden lg:block text-sm text-slate-500 mt-1">Découvrez ce que nos clients pensent de ce logement.</p>
                </div>
                <div className="hidden lg:block text-center">
                  <p className="flex items-center gap-2">
                    <span className="text-4xl font-extrabold">{roomAvg !== null ? frenchDecimal(roomAvg) : '—'}</span>
                    <Stars value={roomAvg ?? 0} size="w-5 h-5" />
                  </p>
                  <p className="text-xs text-slate-500">({roomCount} avis)</p>
                </div>
              </div>
              <div className="hidden lg:grid grid-cols-[1.4fr_1fr] gap-6 mt-2 items-center">
                <div className="space-y-3">
                  {criteria.length > 0 ? (
                    criteria.map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-28 text-sm text-slate-600">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-[#FF6A13] rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right text-sm font-semibold">{frenchDecimal(value)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Aucun avis pour le moment.</p>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-600">
                  <Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" className="w-9 h-9 text-[#FF6A13] mx-auto mb-3" />
                  {roomCount} voyageur{roomCount > 1 ? 's' : ''}<br />
                  {roomCount > 1 ? 'ont déjà laissé un avis' : 'a déjà laissé un avis'}
                </div>
              </div>
              {/* mobile répartition */}
              <div className="lg:hidden mt-4 grid grid-cols-[auto_1fr] gap-5 items-center">
                <div>
                  <p className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold">{roomAvg !== null ? frenchDecimal(roomAvg) : '—'}</span>
                    <span className="flex pb-1.5"><Stars value={roomAvg ?? 0} size="w-4 h-4" /></span>
                  </p>
                  <p className="text-sm text-slate-500 mt-1">({roomCount} avis)</p>
                </div>
                <div className="space-y-1.5 border-l border-slate-100 pl-5">
                  {distribution.length > 0 ? (
                    distribution.map((row) => (
                      <div key={row.note} className="flex items-center gap-2 text-xs">
                        <span className="w-3">{row.note}</span>
                        <Ic d={STAR_PATH} className="w-3.5 h-3.5 fill-[#FF6A13] text-[#FF6A13]" />
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#FF6A13]" style={{ width: `${row.percent}%` }} />
                        </div>
                        <span className="w-4 text-right text-slate-600">{row.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">Aucun avis pour le moment.</p>
                  )}
                </div>
              </div>
            </section>

            {/* État de l'avis (mobile) : confirmation, avis déjà publié ou blocage */}
            {!canReview && (
              <section className="lg:hidden rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
                <h2 className="text-lg font-bold">{myReview ? 'Votre avis' : 'Laisser un avis'}</h2>
                {success && (
                  <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]" role="status">
                    Merci ! Votre avis a bien été publié.
                  </p>
                )}
                {myReview ? (
                  <div className="mt-3">
                    <p className="text-sm text-slate-500">Vous avez déjà laissé un avis pour ce séjour.</p>
                    <div className="mt-3 rounded-xl border border-slate-100 p-4">
                      <p className="flex items-center gap-2 text-sm">
                        <Stars value={myReview.note_appartement} />
                        <span className="font-semibold">{myReview.note_appartement}/5</span>
                        <span className="text-slate-500">Logement</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Gérant : {myReview.note_gerant}/5 · {reviewDate(myReview.created_at)}
                      </p>
                      {myReview.commentaire && (
                        <p className="mt-2 text-sm leading-relaxed text-[#1B2A4A]/90">{myReview.commentaire}</p>
                      )}
                      <ReviewPhotos photos={reservationPhotos} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-slate-100 p-4">
                    <p className="text-sm text-slate-600">{blockedReason}</p>
                  </div>
                )}
                <Link to={staysPath} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#2f5bbf]">
                  ← Retour à mes réservations
                </Link>
              </section>
            )}

            {/* Écrire un avis (PC) */}
            <section className="hidden lg:block rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{myReview ? 'Votre avis' : 'Écrire un avis'}</h2>
              </div>

              {success && (
                <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]" role="status">
                  Merci ! Votre avis a bien été publié.
                </p>
              )}

              {canReview ? (
                <>
                  <p className="text-sm text-slate-500 mt-1">Votre avis aide les prochains voyageurs à faire le bon choix.</p>
                  {reviewFormBody(true)}
                </>
              ) : myReview ? (
                <div className="mt-3">
                  <p className="text-sm text-slate-500">Vous avez déjà laissé un avis pour ce séjour.</p>
                  <div className="mt-3 rounded-xl border border-slate-100 p-4">
                    <p className="flex items-center gap-2 text-sm">
                      <Stars value={myReview.note_appartement} />
                      <span className="font-semibold">{myReview.note_appartement}/5</span>
                      <span className="text-slate-500">Logement</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Gérant : {myReview.note_gerant}/5 · {reviewDate(myReview.created_at)}
                    </p>
                    {myReview.commentaire && (
                      <p className="mt-2 text-sm leading-relaxed text-[#1B2A4A]/90">{myReview.commentaire}</p>
                    )}
                    <ReviewPhotos photos={reservationPhotos} />
                  </div>
                  <Link to={staysPath} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#2f5bbf]">
                    ← Retour à mes réservations
                  </Link>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-100 p-4">
                  <p className="text-sm text-slate-600">{blockedReason}</p>
                  <Link to={staysPath} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#2f5bbf]">
                    ← Retour à mes réservations
                  </Link>
                </div>
              )}
            </section>

            {/* Mobile : bouton écrire un avis (barre fixe commune plus bas) */}
          </div>

          {/* Colonne droite : liste des avis */}
          <section className="lg:rounded-2xl lg:bg-white lg:shadow-sm lg:border lg:border-slate-100 lg:p-6">
            <div className="hidden lg:flex items-center justify-between">
              <h2 className="text-xl font-bold">Avis récents <span className="font-medium text-slate-500">({roomCount})</span></h2>
              <select value={sortIdx} onChange={(e) => setSortIdx(Number(e.target.value))} className="rounded-lg border border-slate-200 text-xs px-3 py-2 bg-white">
                <option value={0}>Les plus récents</option>
                <option value={1}>Les mieux notés</option>
              </select>
            </div>
            <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar text-sm">
              {[`Tous (${roomCount})`, 'Les plus récents', 'Les mieux notés', '5 étoiles'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => {
                    setFilter(i);
                    if (i === 1) setSortIdx(0);
                    if (i === 2) setSortIdx(1);
                  }}
                  className={`shrink-0 rounded-full px-4 py-2 ${filter === i ? 'bg-[#FF6A13] text-white font-medium' : 'bg-white border border-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {filteredReviews.length === 0 && (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
                  Aucun avis pour ce filtre.
                </p>
              )}
              {filteredReviews.map((review) => (
                <article key={review.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 lg:p-5">
                  <div className="flex gap-3">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-lg font-semibold text-slate-600">
                        {review.client_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>
                        <p className="font-semibold text-sm">{review.client_name}</p>
                        <p className="text-xs text-slate-500">{reviewDate(review.created_at)}</p>
                      </div>
                      <p className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        <Stars value={review.note_appartement} size="w-3.5 h-3.5" />
                        <span>{review.note_appartement}/5</span>
                        <span className="text-slate-500">· Gérant {review.note_gerant}/5</span>
                      </p>
                      {review.commentaire && (
                        <p className="mt-2 text-sm leading-relaxed text-[#1B2A4A]/90">{review.commentaire}</p>
                      )}
                      <ReviewPhotos photos={reservationPhotos} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Link to={roomDetailPath} className="hidden lg:flex mt-4 items-center justify-between rounded-xl border border-slate-200 px-5 py-3 text-xs font-medium">
              <span className="flex-1 text-center">Voir la fiche du logement</span>
              <Ic d="m9 18 6-6-6-6" className="w-4 h-4" />
            </Link>
          </section>
        </div>

        <button type="button" onClick={() => navigate(staysPath)} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#2f5bbf]">
          ← Retour à mes réservations
        </button>
      </main>

      <div className="linkhoo-avis__footer">
        <LandingFooter />
      </div>

      {/* Barre fixe mobile */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100">
        {canReview && (
          <div className="px-4 pt-3">
            <button onClick={() => setMobileFormOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] text-white font-semibold py-3.5">
              <Ic d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" className="w-5 h-5" />
              Écrire un avis
            </button>
          </div>
        )}
        <nav className="grid grid-cols-4 text-[11px] text-[#1B2A4A] pt-2 pb-5">
          <Link to={homePath} className="flex flex-col items-center gap-1"><Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-6 h-6" />Accueil</Link>
          <Link to={searchPath} className="flex flex-col items-center gap-1"><Ic d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" className="w-6 h-6" />Rechercher</Link>
          <Link to={favoritesPath} className="flex flex-col items-center gap-1"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-6 h-6" />Favoris</Link>
          <Link to={profilePath} className="flex flex-col items-center gap-1"><Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-6 h-6" />Mon compte</Link>
        </nav>
      </div>

      {/* Mobile form modal */}
      {mobileFormOpen && canReview && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Écrire un avis</h2>
              <button onClick={() => setMobileFormOpen(false)} className="p-1" aria-label="Fermer">
                <Ic d="M18 6 6 18M6 6l12 12" className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-1">Votre avis aide les prochains voyageurs à faire le bon choix.</p>
            {reviewFormBody(false)}
            <button type="button" onClick={() => setMobileFormOpen(false)} className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
