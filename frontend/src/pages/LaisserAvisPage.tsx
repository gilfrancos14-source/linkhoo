import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { setAuthTokenGetter, apiReviews, type ClientMineReservationData } from '../lib/api';
import { getMyReservations } from '../lib/reservations';

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
    <span className={`flex ${size}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className={`w-full h-full ${i < full || (i === full && half) ? 'fill-[#FF6A13] text-[#FF6A13]' : 'fill-[#E2E8F0] text-[#E2E8F0]'}`} viewBox="0 0 24 24">
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      ))}
    </span>
  );
}

const IMGS = ['photo-1631049307264-da0ec9d70304', 'photo-1522771739844-6a9f6d5f14af', 'photo-1584622650111-993a426fbf0a', 'photo-1560448204-e02f11c3d0e2', 'photo-1505693416388-ac5ce068fe85', 'photo-1502672260266-1c1ef2d93688', 'photo-1493809842364-78817add7ffb', 'photo-1540518614846-7eded433c457'].map((id) => `https://images.unsplash.com/${id}?w=900&q=70`);
const REVIEW_PHOTOS = [IMGS[0], IMGS[3], IMGS[1]];

interface Review { id: number; name: string; date: string; ts: number; note: number; likes: number; color: string; avatar: string; photos: string[]; text: string; pending?: boolean; liked?: boolean; }

const INITIAL_REVIEWS: Review[] = [
  { id: 1, name: 'Aminata Traoré', date: '15 oct. 2025', ts: Date.parse('2025-10-15'), note: 5, likes: 6, color: 'bg-amber-700', avatar: 'https://randomuser.me/api/portraits/women/68.jpg', photos: REVIEW_PHOTOS, text: "Super séjour ! La chambre est spacieuse, propre et très bien équipée. Le balcon est un vrai plus, avec une belle vue. L'hôte est accueillant et toujours disponible. Je recommande à 100% !" },
  { id: 2, name: 'Koffi Mensah', date: '2 oct. 2025', ts: Date.parse('2025-10-02'), note: 4, likes: 3, color: 'bg-slate-700', avatar: 'https://randomuser.me/api/portraits/men/75.jpg', photos: REVIEW_PHOTOS, text: "Très bon séjour dans l'ensemble. La chambre est confortable et bien située. Seul petit bémol : le Wi-Fi était un peu lent par moments." },
  { id: 3, name: 'Sophie Laurent', date: '28 sept. 2025', ts: Date.parse('2025-09-28'), note: 5, likes: 4, color: 'bg-rose-700', avatar: 'https://randomuser.me/api/portraits/women/65.jpg', photos: REVIEW_PHOTOS, text: "Une belle expérience ! La chambre est conforme aux photos, propre et calme. Le propriétaire est très gentil et arrangeant. Je reviendrai sans hésiter !" },
];

const CRITERIA = [['Propreté', 4.8], ['Confort', 4.6], ['Emplacement', 4.7], ['Équipements', 4.5], ['Accueil', 4.8]] as [string, number][];
const DIST = [[5, 8], [4, 3], [3, 1], [2, 0], [1, 0]] as [number, number][];

export default function LaisserAvisPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const homePath = useHomePath();
  const { getToken, isLoaded } = useAuth();

  const [reservation, setReservation] = useState<ClientMineReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cur, setCur] = useState(0);
  const [filter, setFilter] = useState(0);
  const [sortIdx, setSortIdx] = useState(0);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [note, setNote] = useState(5);
  const [commentaire, setCommentaire] = useState('');
  const [count, setCount] = useState(0);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formMsgVisible, setFormMsgVisible] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !reservationId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getMyReservations()
      .then((res) => {
        if (cancelled) return;
        const found = res.find((r) => r.id === reservationId);
        if (!found) { setError('Réservation introuvable.'); return; }
        setReservation(found);
      })
      .catch(() => { if (!cancelled) setError('Impossible de charger la réservation.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isLoaded, reservationId]);

  const title = reservation?.room_title || 'Chambre moderne avec balcon';
  const img = reservation?.room?.img || 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200';
  const photos = [img, img, img, img, img, img, img, img];
  const safeCur = Math.min(cur, photos.length - 1);

  const show = (i: number) => setCur((i + photos.length) % photos.length);

  const filteredReviews = [...reviews]
    .filter((r) => filter !== 3 || r.note === 5)
    .sort((a, b) => {
      const best = sortIdx === 1;
      if (filter === 2) return b.likes - a.likes;
      if (best) return b.note - a.note || b.ts - a.ts;
      return b.ts - a.ts;
    });

  const toggleLike = (id: number) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, liked: !r.liked, likes: r.liked ? r.likes - 1 : r.likes + 1 } : r)));
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.size <= 5 * 1024 * 1024);
    const urls = files.map((f) => URL.createObjectURL(f));
    setUploaded((prev) => [...prev, ...urls].slice(0, 5));
    e.target.value = '';
  };

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!reservation || sending) return;
    const t = commentaire.trim();
    setFormMsgVisible(true);
    if (t.length < 10) { setFormMsg('Écrivez au moins 10 caractères pour publier votre avis.'); return; }
    setSending(true);
    setError('');
    try {
      await apiReviews.create({ reservation_id: reservation.id, note_appartement: note, note_gerant: note, commentaire: t || undefined });
      const newReview: Review = { id: Date.now(), name: 'Gil francos', date: "Aujourd'hui", ts: Date.now(), note, likes: 0, color: 'bg-[#1B2A4A]', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', text: t, photos: [...uploaded], pending: true };
      setReviews((prev) => [newReview, ...prev]);
      setFormMsg('Merci ! Votre avis sera visible après validation.');
      setCommentaire(''); setCount(0); setUploaded([]); setNote(5);
      setFilter(0);
      setSuccess(true);
      window.setTimeout(() => { setFormMsgVisible(false); navigate(`${homePath}/compte?view=stays`); }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de publier l’avis.');
      setFormMsgVisible(false);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="linkhoo-avis min-h-screen bg-[#FAFAFA] antialiased" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}><main className="mx-auto max-w-7xl px-4 py-10 lg:px-8"><p className="text-sm text-slate-500">Chargement…</p></main></div>;
  }
  if (error && !reservation) {
    return <div className="linkhoo-avis min-h-screen bg-[#FAFAFA] antialiased" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}><main className="mx-auto max-w-7xl px-4 py-10 lg:px-8"><p className="text-sm text-red-600" role="alert">{error}</p><button type="button" onClick={() => navigate(`${homePath}/compte?view=stays`)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FF6A13] px-4 py-2.5 text-sm font-semibold text-white">Retour à mes réservations</button></main></div>;
  }

  return (
    <div className="linkhoo-avis bg-[#FAFAFA] text-[#1B2A4A] antialiased pb-40 lg:pb-0" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 lg:h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="#" className="lg:hidden p-1 -ml-1" aria-label="Retour"><Ic d="m15 18-6-6 6-6" className="w-6 h-6" /></a>
            <a href="#" className="flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#FF6A13] text-white"><Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-5 h-5" /></span>
              <span className="leading-none">
                <span className="block text-2xl font-extrabold tracking-tight">Link<span className="text-[#FF6A13]">hoo</span></span>
                <span className="hidden lg:block text-[11px] text-slate-500 mt-0.5">Des logements, des histoires</span>
              </span>
            </a>
          </div>
          <nav className="hidden lg:flex items-center gap-9 text-sm font-medium">
            <a href="#" className="flex items-center gap-2"><Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-4 h-4" />Accueil</a>
            <a href="#" className="flex items-center gap-2"><Ic d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" className="w-4 h-4" />Rechercher</a>
            <a href="#" className="flex items-center gap-2"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-4 h-4" />Favoris</a>
            <a href="#" className="flex items-center gap-2"><Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className="w-4 h-4" />Messages</a>
          </nav>
          <div className="hidden lg:flex items-center gap-6">
            <button className="relative" aria-label="Notifications">
              <Ic d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 grid place-items-center w-4 h-4 rounded-full bg-[#FF6A13] text-white text-[10px] font-bold">2</span>
            </button>
            <button className="flex items-center gap-2 text-sm font-medium">
              <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="" className="w-10 h-10 rounded-full object-cover bg-[#1B2A4A]" />
              Gil francos <Ic d="m6 9 6 6 6-6" className="w-4 h-4" />
            </button>
          </div>
          <div className="lg:hidden flex items-center gap-4">
            <button aria-label="Favori"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-6 h-6" /></button>
            <button aria-label="Partager"><Ic d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" className="w-6 h-6" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto lg:px-8">
        {/* Fil d'Ariane */}
        <nav className="hidden lg:flex items-center gap-2 text-sm py-4">
          <a href="#" className="hover:text-[#FF6A13]">Accueil</a>
          <Ic d="m9 18 6-6-6-6" className="w-4 h-4 text-slate-400" />
          <a href="#" className="hover:text-[#FF6A13]">Cocody</a>
          <Ic d="m9 18 6-6-6-6" className="w-4 h-4 text-slate-400" />
          <span className="text-slate-600">{title}</span>
        </nav>

        {/* FICHE LOGEMENT */}
        <section className="bg-white lg:rounded-2xl lg:shadow-sm lg:p-5 lg:grid lg:grid-cols-[1.5fr_1.1fr_.9fr] lg:gap-6">
          <div className="flex gap-3">
            <div className="relative flex-1 h-56 sm:h-72 lg:h-72 lg:rounded-xl overflow-hidden bg-slate-200">
              <img src={photos[safeCur]} className="w-full h-full object-cover" alt={title} />
              <button onClick={() => show(cur - 1)} className="hidden lg:grid absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 place-items-center rounded-full bg-white shadow" aria-label="Précédent">
                <Ic d="m15 18-6-6 6-6" className="w-5 h-5" />
              </button>
              <button onClick={() => show(cur + 1)} className="hidden lg:grid absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 place-items-center rounded-full bg-white shadow" aria-label="Suivant">
                <Ic d="m9 18 6-6-6-6" className="w-5 h-5" />
              </button>
              <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-[#1B2A4A]/70 text-white text-xs font-semibold px-2.5 py-1.5">
                {safeCur + 1}/{photos.length}
              </span>
            </div>
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
          </div>

          <div className="relative -mt-5 lg:mt-0 rounded-t-3xl lg:rounded-none bg-white p-4 lg:p-0">
            <span className="hidden lg:inline-block rounded-full bg-[#FFF3EB] text-[#FF6A13] text-xs font-semibold px-3 py-1">Chambre privée</span>
            <div className="flex items-start justify-between gap-3 lg:mt-3">
              <div>
                <h1 className="text-xl lg:text-2xl font-extrabold">{title}</h1>
                <p className="flex items-center gap-1.5 text-sm text-slate-600 mt-2">
                  <Ic d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" className="w-4 h-4 text-[#FF6A13]" />
                  Cocody, Abidjan
                </p>
                <p className="flex items-center gap-2 mt-2 text-sm">
                  <Stars value={4.7} />
                  <b>4,7</b>
                  <span className="text-slate-500">(12 avis)</span>
                </p>
              </div>
              <div className="lg:hidden shrink-0 rounded-xl bg-[#FFF3EB] px-3 py-2.5">
                <p className="text-xs text-slate-600">À partir de</p>
                <p className="font-extrabold whitespace-nowrap">75 000 FCFA <span className="text-xs font-normal">/ nuit</span></p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-slate-600">
              <li className="flex items-center gap-1.5"><Ic d="M2 20.5A4 4 0 0 1 8 17h2a4 4 0 0 1 6 3.5M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-4 h-4" />1 lit double</li>
              <li className="flex items-center gap-1.5"><Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-4 h-4" />2 personnes</li>
              <li className="flex items-center gap-1.5"><Ic d="M5 12.859a10 10 0 0 1 5.17-2.69M19 12.859a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764M12 20h.01M8.5 16.429a5 5 0 0 1 7 0" className="w-4 h-4" />Wi-Fi</li>
              <li className="flex items-center gap-1.5"><Ic d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" className="w-4 h-4" />Balcon</li>
            </ul>
          </div>

          <aside className="hidden lg:block self-start rounded-2xl bg-[#FFF3EB] border border-orange-100 p-5">
            <p className="text-sm text-slate-600">À partir de</p>
            <p className="text-3xl font-extrabold mt-1">75 000 FCFA <span className="text-base font-medium">/ nuit</span></p>
            <button className="mt-5 w-full flex items-center justify-between rounded-xl bg-[#FF6A13] hover:bg-orange-600 transition text-white font-semibold px-5 py-3.5">
              <span className="flex-1 text-center">Réserver maintenant</span>
              <Ic d="m9 18 6-6-6-6" className="w-5 h-5" />
            </button>
          </aside>
        </section>

        {/* Onglets mobile */}
        <nav className="lg:hidden flex gap-7 overflow-x-auto no-scrollbar px-5 border-b border-slate-100 bg-white text-[15px]">
          <a href="#" className="py-4 text-slate-600">Description</a>
          <a href="#" className="py-4 text-slate-600">Équipements</a>
          <a href="#" className="py-4 text-[#FF6A13] font-semibold border-b-2 border-[#FF6A13]">Avis</a>
          <a href="#" className="py-4 text-slate-600">Localisation</a>
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
                <a href="#" className="lg:hidden flex items-center gap-1 text-xs text-[#1B2A4A]/80">Voir tous les avis <Ic d="m9 18 6-6-6-6" className="w-4 h-4" /></a>
                <div className="hidden lg:block text-center">
                  <p className="flex items-center gap-2"><span className="text-4xl font-extrabold">4,7</span><Stars value={4.7} size="w-5 h-5" /></p>
                  <p className="text-xs text-slate-500">(12 avis)</p>
                </div>
              </div>
              <div className="hidden lg:grid grid-cols-[1.4fr_1fr] gap-6 mt-2 items-center">
                <div className="space-y-3">
                  {CRITERIA.map(([label, value]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-28 text-sm text-slate-600">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-[#FF6A13] rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold">{value.toFixed(1).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-600">
                  <Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" className="w-9 h-9 text-[#FF6A13] mx-auto mb-3" />
                  12 voyageurs<br />ont déjà laissé un avis
                </div>
              </div>
              {/* mobile répartition */}
              <div className="lg:hidden mt-4 grid grid-cols-[auto_1fr] gap-5 items-center">
                <div><p className="flex items-end gap-2"><span className="text-4xl font-extrabold">4,7</span><span className="flex pb-1.5"><Stars value={4.7} size="w-4 h-4" /></span></p><p className="text-sm text-slate-500 mt-1">(12 avis)</p></div>
                <div className="space-y-1.5 border-l border-slate-100 pl-5">
                  {DIST.map(([s, c]) => (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <span className="w-3">{s}</span>
                      <Ic d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" className="w-3.5 h-3.5 fill-[#FF6A13] text-[#FF6A13]" />
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#FF6A13]" style={{ width: `${(c / 12) * 100}%` }} /></div>
                      <span className="w-4 text-right text-slate-600">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Écrire un avis (PC) */}
            <section className="hidden lg:block rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Écrire un avis</h2>
              </div>
              <p className="text-sm text-slate-500 mt-1">Votre avis aide les prochains voyageurs à faire le bon choix.</p>
              <div className="flex items-center gap-3 mt-4">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setNote(n)} aria-label={`${n} étoiles`} className="text-2xl leading-none" style={{ color: n <= note ? '#FF6A13' : '#E2E8F0' }}>★</button>
                  ))}
                </div>
                <span className="text-sm font-semibold">{note}/5</span>
              </div>
              <div className="relative mt-4">
                <textarea
                  value={commentaire}
                  onChange={(e) => { setCommentaire(e.target.value); setCount(e.target.value.length); }}
                  maxLength={500}
                  rows={5}
                  placeholder="Partagez votre expérience : que avez-vous aimé ? Qu'est-ce qui pourrait être amélioré ?"
                  className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A13]/40"
                />
                <span className="absolute bottom-3 right-4 text-xs text-slate-400">{count}/500</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-xs text-slate-600">
                <p className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5"><Ic d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" className="text-[#FF6A13] shrink-0 w-4 h-4" />Votre avis est authentique</p>
                <p className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5"><Ic d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76m6 3.38 2 2 4-4" className="text-[#FF6A13] shrink-0 w-4 h-4" />Il sera visible après validation</p>
                <p className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="text-[#FF6A13] shrink-0 w-4 h-4" />Cela aide la communauté</p>
              </div>
              <p className="mt-5 text-sm font-semibold">Ajouter des photos <span className="font-normal text-slate-500">(optionnel)</span></p>
              <label className="mt-2 flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-5 text-center cursor-pointer hover:border-[#FF6A13]/50">
                <Ic d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-6 h-6 text-[#FF6A13]" />
                <span className="text-sm">Cliquez pour ajouter des photos</span>
                <span className="text-xs text-slate-400">JPG, PNG — Max 5 Mo (jusqu'à 5 photos)</span>
                <input type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={handlePhotos} />
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {uploaded.map((s, i) => (
                  <img key={i} src={s} className="w-16 h-16 rounded-lg object-cover bg-slate-200" alt="" />
                ))}
              </div>
              {success && <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]" role="status">Merci ! Votre avis a bien été publié.</p>}
              {formMsgVisible && <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]">{formMsg}</p>}
              {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
              <button
                type="button"
                disabled={sending || success}
                onClick={handleSubmit}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] hover:bg-orange-600 transition text-white font-semibold py-3.5 disabled:opacity-60"
              >
                <Ic d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" className="w-5 h-5" />
                {sending ? 'Publication…' : 'Publier mon avis'}
              </button>
            </section>

            {/* Mobile : bouton écrire un avis */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100">
              <div className="px-4 pt-3">
                <button onClick={() => setMobileFormOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] text-white font-semibold py-3.5">
                  <Ic d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" className="w-5 h-5" />
                  Écrire un avis
                </button>
              </div>
              <nav className="grid grid-cols-4 text-[11px] text-[#1B2A4A] pt-2 pb-5">
                <a href="#" className="flex flex-col items-center gap-1"><Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-6 h-6" />Accueil</a>
                <a href="#" className="flex flex-col items-center gap-1"><Ic d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" className="w-6 h-6" />Rechercher</a>
                <a href="#" className="flex flex-col items-center gap-1"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-6 h-6" />Favoris</a>
                <a href="#" className="flex flex-col items-center gap-1"><Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-6 h-6" />Mon compte</a>
              </nav>
            </div>
          </div>

          {/* Colonne droite : liste des avis */}
          <section className="lg:rounded-2xl lg:bg-white lg:shadow-sm lg:border lg:border-slate-100 lg:p-6">
            <div className="hidden lg:flex items-center justify-between">
              <h2 className="text-xl font-bold">Avis récents <span className="font-medium text-slate-500">(12)</span></h2>
              <select value={sortIdx} onChange={(e) => setSortIdx(Number(e.target.value))} className="rounded-lg border border-slate-200 text-xs px-3 py-2 bg-white">
                <option value={0}>Les plus récents</option>
                <option value={1}>Les mieux notés</option>
              </select>
            </div>
            <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar text-sm">
              {['Tous (12)', 'Récents', 'Plus utiles', '5 étoiles'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setFilter(i)}
                  className={`shrink-0 rounded-full px-4 py-2 ${filter === i ? 'bg-[#FF6A13] text-white font-medium' : 'bg-white border border-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {filteredReviews.length === 0 && (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">Aucun avis pour ce filtre.</p>
              )}
              {filteredReviews.map((r) => (
                <article key={r.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 lg:p-5">
                  <div className="flex gap-3">
                    <img src={r.avatar} alt="" className={`shrink-0 w-12 h-12 rounded-full object-cover ${r.color}`} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{r.name}</p>
                          <p className="text-xs text-slate-500">{r.date}</p>
                        </div>
                        <button aria-label="Options" className="p-1"><Ic d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" className="w-5 h-5" /></button>
                      </div>
                      <p className="flex items-center gap-2 mt-1 text-xs"><Stars value={r.note} size="w-3.5 h-3.5" />{r.note}/5</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#1B2A4A]/90">{r.text}</p>
                      {r.pending && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FFF3EB] px-3 py-1 text-xs font-medium text-[#FF6A13]"><Ic d="M12 6v6l4 2M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" className="w-3.5 h-3.5" />En attente de validation</p>}
                      {r.photos.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-3 ${r.id === 1 || r.pending ? 'flex' : 'hidden lg:flex'}`}>
                          {r.photos.map((s, i) => (
                            <button key={i} onClick={() => setLightbox(s)} className="w-20 h-14 lg:w-[5.5rem] lg:h-16 rounded-md overflow-hidden">
                              <img src={s} className="w-full h-full object-cover bg-slate-200" alt="" />
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => toggleLike(r.id)}
                        className={`mt-3 flex items-center gap-1.5 text-xs ${r.liked ? 'text-[#FF6A13] font-semibold' : 'text-slate-500'}`}
                      >
                        <Ic d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" className={`w-4 h-4 ${r.liked ? 'fill-[#FF6A13] text-[#FF6A13]' : ''}`} />
                        Utile ({r.likes})
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <a href="#" className="hidden lg:flex mt-4 items-center justify-between rounded-xl border border-slate-200 px-5 py-3 text-xs font-medium">
              <span className="flex-1 text-center">Voir tous les avis</span>
              <Ic d="m9 18 6-6-6-6" className="w-4 h-4" />
            </a>
          </section>
        </div>

        {/* Footer message (PC) */}
        <footer className="hidden lg:flex items-center justify-between mt-8 rounded-t-[3rem] bg-[#FFF3EB] px-12 py-8">
          <div className="flex items-center gap-6">
            <div className="flex items-end">
              <Ic d="M12 22c-4 0-7-2-7-6 0-3 2-5 4-7" className="w-8 h-8 text-orange-400" />
              <Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-20 h-20 text-[#FF6A13] mx-1" />
              <Ic d="M7 20c0-2 1-4 3-5" className="w-8 h-8 text-orange-400" />
            </div>
            <div><p className="font-bold">Merci pour votre confiance !</p><p className="text-sm text-slate-600">Vos avis nous aident à améliorer continuellement la qualité de nos logements.</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="-rotate-3">
              <p className="italic text-lg text-[#1B2A4A]/80" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>À bientôt sur Linkhoo !</p>
              <svg viewBox="0 0 160 10" className="ml-auto w-40 h-2.5 text-[#FF6A13]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M2 7c40-6 90-6 156-2" /></svg>
            </div>
            <Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-7 h-7 text-[#FF6A13]" />
          </div>
        </footer>

        <button type="button" onClick={() => navigate(`${homePath}/compte?view=stays`)} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#2f5bbf]">
          ← Retour à mes réservations
        </button>
      </main>

      {/* Barre fixe mobile */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100">
        <div className="px-4 pt-3">
          <button onClick={() => setMobileFormOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] text-white font-semibold py-3.5">
            <Ic d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" className="w-5 h-5" />
            Écrire un avis
          </button>
        </div>
        <nav className="grid grid-cols-4 text-[11px] text-[#1B2A4A] pt-2 pb-5">
          <a href="#" className="flex flex-col items-center gap-1"><Ic d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="w-6 h-6" />Accueil</a>
          <a href="#" className="flex flex-col items-center gap-1"><Ic d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" className="w-6 h-6" />Rechercher</a>
          <a href="#" className="flex flex-col items-center gap-1"><Ic d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" className="w-6 h-6" />Favoris</a>
          <a href="#" className="flex flex-col items-center gap-1"><Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="w-6 h-6" />Mon compte</a>
        </nav>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-h-full max-w-full rounded-xl" alt="" />
        </div>
      )}

      {/* Mobile form modal */}
      {mobileFormOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Écrire un avis</h2>
              <button onClick={() => setMobileFormOpen(false)} className="p-1" aria-label="Fermer"><Ic d="M18 6 6 18M6 6l12 12" className="w-6 h-6" /></button>
            </div>
            <p className="text-sm text-slate-500 mt-1">Votre avis aide les prochains voyageurs à faire le bon choix.</p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setNote(n)} className="text-2xl leading-none" style={{ color: n <= note ? '#FF6A13' : '#E2E8F0' }}>★</button>
                ))}
              </div>
              <span className="text-sm font-semibold">{note}/5</span>
            </div>
            <div className="relative mt-4">
              <textarea value={commentaire} onChange={(e) => { setCommentaire(e.target.value); setCount(e.target.value.length); }} maxLength={500} rows={5} placeholder="Partagez votre expérience : que avez-vous aimé ? Qu'est-ce qui pourrait être amélioré ?" className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A13]/40" />
              <span className="absolute bottom-3 right-4 text-xs text-slate-400">{count}/500</span>
            </div>
            {success && <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]" role="status">Merci ! Votre avis a bien été publié.</p>}
            {formMsgVisible && <p className="mt-3 rounded-xl bg-[#FFF3EB] px-4 py-3 text-sm font-medium text-[#FF6A13]">{formMsg}</p>}
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
            <button type="button" disabled={sending || success} onClick={handleSubmit} className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] hover:bg-orange-600 transition text-white font-semibold py-3.5 disabled:opacity-60">
              {sending ? 'Publication…' : 'Publier mon avis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}