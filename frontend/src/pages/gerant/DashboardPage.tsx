import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import BrandLogo from '../../components/BrandLogo';
import { fetchMyRooms, type Room } from '../../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import { getReservations, statutLabels, type Reservation } from '../../lib/reservations';

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

const ROOM_GRADIENTS = [
  'from-sky-300 to-amber-200',
  'from-orange-200 to-rose-300',
  'from-amber-200 to-orange-400',
  'from-sky-400 to-slate-300',
  'from-emerald-500 to-sky-400',
];

const CATEGORY_STYLES = [
  { icon: 'build', cls: 'bg-sky-100 text-sky-500' },
  { icon: 'cal', cls: 'bg-amber-100 text-amber-500' },
  { icon: 'chat', cls: 'bg-pink-100 text-pink-500' },
  { icon: 'home', cls: 'bg-orange-100 text-dash-brand' },
  { icon: 'home', cls: 'bg-violet-100 text-violet-500' },
];

const CATEGORY_PILLS = [
  'bg-sky-100 text-sky-600',
  'bg-indigo-100 text-indigo-500',
  'bg-pink-100 text-pink-500',
  'bg-teal-100 text-teal-600',
  'bg-violet-100 text-violet-500',
];

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'CL'
  );
}

function formatDay(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nightsOf(reservation: Reservation): number {
  const start = Date.parse(reservation.dateDebut);
  const end = Date.parse(reservation.dateFin);
  if (Number.isNaN(start) || Number.isNaN(end)) return reservation.dureeNombre;
  const nights = Math.round((end - start) / 86_400_000);
  return Number.isFinite(nights) && nights > 0 ? nights : 1;
}

function statutPill(statut: Reservation['statut']): string {
  if (statut === 'confirmee') return 'bg-emerald-100 text-emerald-600';
  if (statut === 'annulee') return 'bg-red-100 text-red-500';
  return 'bg-orange-100 text-orange-500';
}

export default function DashboardPage() {
  const homePath = useHomePath();
  const chrome = useGerantChrome();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const demandesPath = `${gerantPath}/reservations/demandes`;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reservationsError, setReservationsError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchMyRooms(), getReservations()])
      .then(([roomsResult, reservationsResult]) => {
        if (!alive) return;

        if (roomsResult.status === 'fulfilled') {
          setRooms(roomsResult.value);
        } else {
          setError('Impossible de charger vos chambres.');
        }

        if (reservationsResult.status === 'fulfilled') {
          setReservations(
            [...reservationsResult.value].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        } else {
          const status = (reservationsResult.reason as { status?: number } | null)?.status;
          setReservationsError(
            status === 403
              ? 'Les réservations sont visibles uniquement pour les gérants vérifiés.'
              : 'Impossible de charger les demandes de réservation.',
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const market = chrome.gerant?.market;
  useEffect(() => {
    if (!market) return;
    let alive = true;
    fetchCategoriesByMarket(market)
      .then((items) => {
        if (alive) setCategories(items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [market]);

  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const categoryTitle = (id: string): string =>
    categories.find((category) => category.id === id)?.title ?? id;

  const categoryEntries = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>();
    rooms.forEach((room) => {
      const current = map.get(room.category);
      map.set(room.category, {
        title: categoryTitle(room.category),
        count: (current?.count ?? 0) + 1,
      });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rooms, categories]);

  const available = rooms.filter((room) => room.disponible).length;
  const occupied = rooms.length - available;
  const totalRooms = rooms.length;
  const availableShare = totalRooms > 0 ? Math.round((available / totalRooms) * 100) : 0;
  const occupiedShare = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
  const recentRooms = rooms.slice(0, 5);
  const recentReservations = reservations.slice(0, 4);

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const firstName = chrome.gerant?.prenom?.trim() || 'Gérant';

  return (
    <div className="gerant-maq1 bg-[#f5f8fc] text-dash-navy antialiased">
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <symbol id="home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5" /></symbol>
        <symbol id="bed" viewBox="0 0 24 24"><path d="M3 20V5M3 16h18v4M21 16v-4a3 3 0 0 0-3-3h-7v7" /><circle cx="7" cy="11" r="1.5" /></symbol>
        <symbol id="cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></symbol>
        <symbol id="chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
        <symbol id="shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" /></symbol>
        <symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></symbol>
        <symbol id="crown" viewBox="0 0 24 24"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z" fill="currentColor" /></symbol>
        <symbol id="mega" viewBox="0 0 24 24"><path d="M3 11v3l12 5V6zM15 9a3 3 0 0 1 0 6M6 15l1 5h3l-1-4" /></symbol>
        <symbol id="down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
        <symbol id="up" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></symbol>
        <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="tag" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></symbol>
        <symbol id="bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" /></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></symbol>
        <symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
        <symbol id="bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></symbol>
        <symbol id="chart" viewBox="0 0 24 24"><path d="M5 21V10M12 21V4M19 21v-8" /></symbol>
        <symbol id="bolt" viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></symbol>
        <symbol id="check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></symbol>
        <symbol id="x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol id="doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
        <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
        <symbol id="build" viewBox="0 0 24 24"><path d="M5 21V4h10v17M15 9h4v12M9 8h2M9 12h2M9 16h2M3 21h18" /></symbol>
        <symbol id="list" viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></symbol>
        <symbol id="dots" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></g></symbol>
      </svg>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 lg:flex">
        <Link to={gerantPath} className="mb-6 flex items-center gap-2.5 px-2" aria-label="Linkhoo - retour à l'accueil">
          <BrandLogo />
        </Link>

          <nav className="space-y-3">
            <Link to={gerantPath} className="grp rounded-xl bg-dash-brand-soft text-dash-brand-dark">
              <Icon id="home" />Aperçu
            </Link>

            <div>
              <div className="grp justify-between">
                <span className="flex items-center gap-3"><Icon id="bed" />Chambres</span>
                <Icon id="up" className="i !h-4 !w-4" />
              </div>
              <div className="pl-3">
                <Link to={chambresPath} className="sub"><Icon id="list" />Toutes les chambres</Link>
                <Link to={`${chambresPath}/ajouter`} className="sub"><Icon id="plus" />Ajouter une chambre</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="cal" />Réservations{chrome.reservationsCount > 0 && <span className="badge">{chrome.reservationsCount}</span>}</div>
              <div className="pl-3">
                <Link to={demandesPath} className="sub"><Icon id="user" />Demandes</Link>
                <Link to={`${gerantPath}/reservations/calendrier`} className="sub"><Icon id="cal" />Calendrier</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="chat" />Messages{chrome.messagesUnread > 0 && <span className="badge">{chrome.messagesUnread}</span>}</div>
              <div className="pl-3">
                <Link to={`${gerantPath}/messages/boite-reception`} className="sub"><Icon id="mail" />Boîte de réception</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between">
                <span className="flex items-center gap-3"><Icon id="shield" />Vérification</span>
                <Icon id="down" className="i !h-4 !w-4" />
              </div>
              <div className="pl-3">
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Mes documents</Link>
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Suivi de vérification</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between">
                <span className="flex items-center gap-3"><Icon id="user" />Profil</span>
                <Icon id="down" className="i !h-4 !w-4" />
              </div>
              <div className="pl-3"><Link to={`${gerantPath}/profil`} className="sub"><Icon id="user" />Mes informations</Link></div>
            </div>

            <div>
              <div className="grp"><Icon id="crown" className="i text-dash-brand" />Premium</div>
              <div className="pl-3"><Link to={`${gerantPath}/premium`} className="sub"><Icon id="cal" />Mon abonnement</Link></div>
            </div>
          </nav>

          <div className="mt-auto rounded-2xl border border-orange-100 bg-dash-brand-soft p-4 pt-5">
            <p className="flex items-center gap-2 text-sm font-bold"><Icon id="crown" className="i h-5 w-5 text-dash-brand" />Passez au Premium</p>
            <p className="mt-2 text-[11px] text-slate-500">Plus de visibilité, plus de réservations !</p>
            <Link to={`${gerantPath}/premium`} className="mt-3 block rounded-lg bg-dash-brand py-2 text-center text-xs font-semibold text-white hover:bg-dash-brand-dark">Voir les avantages</Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-7">
          <header className="flex items-center gap-4">
            <label className="card flex max-w-3xl flex-1 items-center gap-3 px-5 py-3 text-slate-400">
              <Icon id="search" className="i h-5 w-5" />
              <input type="search" placeholder="Rechercher une chambre, une catégorie…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <button type="button" className="relative ml-auto p-2 text-dash-navy" aria-label="Notifications">
              <Icon id="bell" className="i h-6 w-6" />
              {chrome.messagesUnread > 0 && <span className="absolute right-0.5 top-0 grid h-4 w-4 place-items-center rounded-full bg-dash-brand text-[10px] font-bold text-white">{chrome.messagesUnread}</span>}
            </button>
            <div className="card flex items-center gap-3 py-2 pl-2 pr-4">
              <span className="avatar h-10 w-10 text-xs">{chrome.initials}</span>
              <div className="hidden text-xs sm:block"><p className="font-semibold">{chrome.displayName}</p><p className="text-slate-400">Gérant</p></div>
              <GerantLogoutButton className="ml-1" />
            </div>
          </header>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-3xl font-extrabold">Bonjour {firstName} 👋</h1>
              <p className="mt-1 text-sm text-slate-500">Voici un aperçu de votre activité sur HabiCI.</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="flex items-center justify-end gap-2 font-semibold text-dash-navy">Aujourd’hui <Icon id="cal" className="i h-4 w-4" /></p>
              <p>{todayLabel}</p>
            </div>
          </div>

          {(error || loading) && (
            <p role={error ? 'alert' : undefined} className={`mt-4 text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>
              {error || 'Chargement de votre activité...'}
            </p>
          )}

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="card flex items-center gap-4 p-5">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-500"><Icon id="bed" className="i h-8 w-8" /></span>
                  <div><p className="text-sm text-slate-600">Chambres enregistrées</p><p className="text-3xl font-bold">{totalRooms}</p><p className="mt-1 text-xs font-medium text-sky-500">{totalRooms > 0 ? 'Toutes vos annonces' : 'Aucune annonce'}</p></div>
                </div>
                <div className="card flex items-center gap-4 p-5">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-emerald-100"><span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white"><Icon id="check" className="i h-5 w-5 !stroke-[2.5]" /></span></span>
                  <div><p className="text-sm text-slate-600">Chambres disponibles</p><p className="text-3xl font-bold">{available}</p><p className="mt-1 text-xs font-medium text-emerald-500">{availableShare}% du parc</p></div>
                </div>
                <div className="card flex items-center gap-4 p-5">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-orange-100 text-dash-brand"><Icon id="home" className="i h-8 w-8" /></span>
                  <div><p className="text-sm text-slate-600">Chambres occupées</p><p className="text-3xl font-bold">{occupied}</p><p className="mt-1 text-xs font-medium text-dash-brand">{occupiedShare}% du parc</p></div>
                </div>
              </div>

              <section className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Catégories de vos chambres</h2>
                  <Link to={chambresPath} className="link">Voir tout <Icon id="arrow" className="i h-3.5 w-3.5" /></Link>
                </div>
                {categoryEntries.length === 0 ? (
                  <p className="py-4 text-sm text-slate-500">Aucune catégorie pour le moment. Ajoutez une chambre pour commencer.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
                    {categoryEntries.map((entry, index) => {
                      const style = CATEGORY_STYLES[index % CATEGORY_STYLES.length];
                      return (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3" key={entry.title}>
                          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${style.cls}`}><Icon id={style.icon} className="i h-6 w-6" /></span>
                          <div className="text-xs"><p className="font-medium">{entry.title}</p><p className="mt-1 text-slate-500">{entry.count}</p></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="grid items-start gap-5 2xl:grid-cols-[1.9fr_1fr]">
                <section className="card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-3 text-lg font-bold"><Icon id="bed" className="i h-6 w-6" />Chambres récentes</h2>
                    <Link to={chambresPath} className="link !text-dash-navy !font-medium">Voir toutes <Icon id="arrow" className="i h-3.5 w-3.5" /></Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="text-slate-600">
                        <tr><th className="pb-3 font-medium">Photo</th><th className="pb-3 font-medium">Titre</th><th className="pb-3 font-medium">Catégorie</th><th className="pb-3 font-medium">Statut</th></tr>
                      </thead>
                      <tbody>
                        {recentRooms.length === 0 && (
                          <tr className="border-t border-slate-100"><td colSpan={4} className="py-4 text-slate-500">Aucune chambre enregistrée pour le moment.</td></tr>
                        )}
                        {recentRooms.map((room, index) => (
                          <tr className="border-t border-slate-100" key={room.id}>
                            <td className="py-3 pr-3">
                              {room.img ? (
                                <img src={room.img} alt="" className="h-12 w-16 rounded-lg object-cover" />
                              ) : (
                                <div className={`h-12 w-16 rounded-lg bg-gradient-to-br ${ROOM_GRADIENTS[index % ROOM_GRADIENTS.length]}`}></div>
                              )}
                            </td>
                            <td className="pr-3"><p className="text-[13px] font-semibold leading-snug">{room.title}</p><p className="mt-0.5 text-slate-400">{[room.quartier, room.ville].filter(Boolean).join(', ') || '—'}</p></td>
                            <td><span className={`pill ${CATEGORY_PILLS[index % CATEGORY_PILLS.length]}`}>{categoryTitle(room.category)}</span></td>
                            <td><span className={`pill ${room.disponible ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-500'}`}>{room.disponible ? 'Disponible' : 'Occupée'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="space-y-5">
                  <section className="card p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="flex items-center gap-3 text-sm font-bold"><Icon id="cal" className="i h-5 w-5 text-slate-500" />Dernières demandes de réservation</h2>
                      <Link to={demandesPath} className="link !font-medium !text-dash-navy">Voir tout <Icon id="arrow" className="i h-3 w-3" /></Link>
                    </div>
                    <ul className="divide-y divide-slate-100 text-[11px]">
                      {reservationsError && (
                        <li className="py-3 text-slate-500">{reservationsError}</li>
                      )}
                      {!reservationsError && recentReservations.length === 0 && (
                        <li className="py-3 text-slate-500">Aucune demande de réservation pour le moment.</li>
                      )}
                      {recentReservations.map((reservation) => {
                        const room = roomsById.get(reservation.roomId);
                        return (
                          <li className="flex items-center gap-3 py-3" key={reservation.id}>
                            <span className="avatar h-10 w-10 text-xs">{initialsOf(reservation.clientName)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{reservation.clientName}</p>
                              <p className="text-slate-500">{formatDay(reservation.createdAt)} · {nightsOf(reservation)} nuit{nightsOf(reservation) > 1 ? 's' : ''} · {room ? categoryTitle(room.category) : reservation.roomTitle}</p>
                            </div>
                            <span className={`pill ${statutPill(reservation.statut)}`}>{statutLabels[reservation.statut]}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>
              </div>

              <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-400 text-white"><Icon id="crown" className="i h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Votre activité, plus de visibilité !</p>
                  <p className="text-xs text-slate-600">Avec le Premium, vous bénéficiez d’un meilleur positionnement, plus de réservations et d’outils avancés.</p>
                </div>
                <Link to={`${gerantPath}/premium`} className="inline-flex items-center gap-2 rounded-lg bg-dash-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-dash-brand-dark">Découvrir le Premium <Icon id="arrow" className="i h-3.5 w-3.5" /></Link>
              </section>
            </div>

            <aside className="card p-5">
              <h2 className="mb-4 flex items-center gap-3 font-bold"><Icon id="bolt" className="i h-5 w-5 text-dash-brand" />Actions rapides</h2>
              <div className="space-y-3">
                <Link to={`${chambresPath}/ajouter`} className="flex items-center gap-4 rounded-xl bg-dash-brand p-4 text-white shadow-lg shadow-orange-200 hover:bg-dash-brand-dark">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/25"><Icon id="plus" className="i h-5 w-5 !stroke-2" /></span>
                  <span><span className="block text-sm font-semibold">Ajouter une chambre</span><span className="block text-xs text-orange-100">Avec l'assistant en 4 étapes</span></span>
                </Link>
                <Link to={`${gerantPath}/reservations`} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 hover:bg-slate-100">
                  <Icon id="cal" className="i h-7 w-7 shrink-0 text-slate-500" />
                  <span><span className="block text-sm font-semibold">Voir mes réservations</span><span className="block text-xs text-slate-500">Gérer les demandes</span></span>
                </Link>
                <Link to={`${gerantPath}/messages/boite-reception`} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 hover:bg-slate-100">
                  <Icon id="chat" className="i h-7 w-7 shrink-0 text-slate-500" />
                  <span><span className="block text-sm font-semibold">Voir mes messages</span><span className="block text-xs text-slate-500">Lire et répondre</span></span>
                </Link>
                <Link to={`${gerantPath}/verification`} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 hover:bg-slate-100">
                  <Icon id="shield" className="i h-7 w-7 shrink-0 text-slate-500" />
                  <span><span className="block text-sm font-semibold">{chrome.gerant?.is_verified ? 'Compte vérifié' : 'Vérifier mon compte'}</span><span className="block text-xs text-slate-500">{chrome.gerant?.is_verified ? 'Statut confirmé' : 'Obtenir le statut vérifié'}</span></span>
                </Link>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
