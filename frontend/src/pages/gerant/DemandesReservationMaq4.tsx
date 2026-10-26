import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { fetchMyRooms, type Room } from '../../data/rooms';
import {
  getReservations,
  statutLabels,
  updateReservationStatut,
  type Reservation,
} from '../../lib/reservations';
import { formatPrice } from '../../lib/roomDisplay';

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

type Statut = 'wait' | 'ok' | 'no';
type TabKey = 'toutes' | 'en_attente' | 'confirmee' | 'annulee';

const PAGE_SIZE = 8;

const statutClass: Record<Statut, string> = {
  wait: 's-wait',
  ok: 's-ok',
  no: 's-no',
};

const GRADIENTS = [
  'from-sky-300 to-amber-200',
  'from-orange-200 to-rose-300',
  'from-emerald-500 to-sky-300',
  'from-sky-400 to-slate-300',
  'from-amber-500 to-emerald-700',
  'from-orange-400 to-amber-800',
];

function statutOf(reservation: Reservation): Statut {
  if (reservation.statut === 'confirmee') return 'ok';
  if (reservation.statut === 'annulee') return 'no';
  return 'wait';
}

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

function gradientOf(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return GRADIENTS[hash % GRADIENTS.length];
}

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShort(iso: string): string {
  const date = isoToDate(iso);
  if (!date) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ` · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function nightsOf(reservation: Reservation): number {
  const start = isoToDate(reservation.dateDebut)?.getTime();
  const end = isoToDate(reservation.dateFin)?.getTime();
  if (start === undefined || end === undefined) return reservation.dureeNombre;
  const nights = Math.round((end - start) / 86_400_000);
  return Number.isFinite(nights) && nights > 0 ? nights : 1;
}

function nightsLabel(count: number): string {
  return `${count} nuit${count > 1 ? 's' : ''}`;
}

function roomsLabel(count: number): string {
  return `${count} chambre${count > 1 ? 's' : ''}`;
}

function bathsLabel(count: number): string {
  return `${count} salle${count > 1 ? 's' : ''} d’eau`;
}

export default function DemandesReservationMaq4() {
  const homePath = useHomePath();
  const chrome = useGerantChrome();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const reservationsPath = `${gerantPath}/reservations`;
  const demandesPath = `${reservationsPath}/demandes`;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<TabKey>('toutes');
  const [roomFilter, setRoomFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getReservations(), fetchMyRooms()])
      .then(([reservationsResult, roomsResult]) => {
        if (!alive) return;

        if (roomsResult.status === 'fulfilled') {
          setRooms(roomsResult.value);
        }

        if (reservationsResult.status === 'fulfilled') {
          const sorted = [...reservationsResult.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setReservations(sorted);
          setSelectedId((current) => (current && sorted.some((item) => item.id === current) ? current : sorted[0]?.id ?? ''));
        } else {
          const status = (reservationsResult.reason as { status?: number } | null)?.status;
          setError(
            status === 403
              ? 'Les réservations sont visibles uniquement pour les gérants vérifiés et Premium.'
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

  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const roomOptions = useMemo(() => {
    const seen = new Map<string, string>();
    reservations.forEach((reservation) => {
      if (!seen.has(reservation.roomId)) {
        seen.set(reservation.roomId, roomsById.get(reservation.roomId)?.title ?? reservation.roomTitle);
      }
    });
    return [...seen.entries()];
  }, [reservations, roomsById]);

  const counts = {
    toutes: reservations.length,
    en_attente: reservations.filter((item) => item.statut === 'en_attente').length,
    confirmee: reservations.filter((item) => item.statut === 'confirmee').length,
    annulee: reservations.filter((item) => item.statut === 'annulee').length,
  };

  const filtered = reservations.filter((reservation) => {
    if (tab !== 'toutes' && reservation.statut !== tab) return false;
    if (roomFilter !== 'all' && reservation.roomId !== roomFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = reservations.find((reservation) => reservation.id === selectedId) ?? null;
  const selectedRoom = selected ? roomsById.get(selected.roomId) ?? null : null;

  const period = useMemo(() => {
    if (reservations.length === 0) return '';
    const starts = reservations.map((item) => isoToDate(item.dateDebut)?.getTime() ?? Infinity);
    const ends = reservations.map((item) => isoToDate(item.dateFin)?.getTime() ?? -Infinity);
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
    const left = new Date(min).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    const right = new Date(max).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    return `Du ${left} au ${right}`;
  }, [reservations]);

  function changeTab(next: TabKey) {
    setTab(next);
    setPage(1);
  }

  function changeRoom(next: string) {
    setRoomFilter(next);
    setPage(1);
  }

  async function changeStatut(statut: 'confirmee' | 'annulee') {
    if (!selected || updating) return;
    setUpdating(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateReservationStatut(selected.id, statut);
      setReservations((current) =>
        current.map((item) => (item.id === selected.id ? { ...item, statut } : item)),
      );
      setActionMessage(statut === 'confirmee' ? 'Réservation confirmée.' : 'Demande refusée.');
    } catch {
      setActionError(statut === 'confirmee' ? 'Impossible de confirmer cette réservation.' : 'Impossible de refuser cette demande.');
    } finally {
      setUpdating(false);
    }
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5);

  return (
    <div className="gerant-maq4 bg-[#f5f8fc] text-dash-navy antialiased">
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
        <symbol id="left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></symbol>
        <symbol id="right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></symbol>
        <symbol id="back" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></symbol>
        <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="tag" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></symbol>
        <symbol id="bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" /></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></symbol>
        <symbol id="doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
        <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
        <symbol id="list" viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></symbol>
        <symbol id="dots" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></g></symbol>
        <symbol id="pin" viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></symbol>
        <symbol id="drop" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></symbol>
        <symbol id="info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></symbol>
        <symbol id="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></symbol>
        <symbol id="check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></symbol>
        <symbol id="x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol id="phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></symbol>
        <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
        <symbol id="quote" viewBox="0 0 24 24"><path d="M5 17c0-4 1-7 5-9v2c-2 1-3 3-3 5h3v5H5zm9 0c0-4 1-7 5-9v2c-2 1-3 3-3 5h3v5h-5z" fill="currentColor" stroke="none" /></symbol>
      </svg>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 lg:flex">
          <Link to={gerantPath} className="mb-6 flex items-center gap-2.5 px-2" aria-label="Linkhoo - retour à l'accueil">
            <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
          </Link>

          <nav className="space-y-3">
            <Link to={gerantPath} className="grp"><Icon id="home" />Aperçu</Link>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="bed" />Chambres</span><Icon id="up" className="i !h-4 !w-4" /></div>
              <div className="pl-2">
                <Link to={chambresPath} className="sub"><Icon id="list" />Toutes les chambres</Link>
                <Link to={`${chambresPath}/ajouter`} className="sub"><Icon id="plus" />Ajouter une chambre</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="cal" className="i text-dash-brand" />Réservations{chrome.reservationsCount > 0 && <span className="badge">{chrome.reservationsCount}</span>}</div>
              <div className="pl-2">
                <Link to={demandesPath} className="sub on" aria-current="page"><Icon id="user" />Demandes</Link>
                <Link to={`${reservationsPath}/calendrier`} className="sub"><Icon id="cal" />Calendrier</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="chat" />Messages{chrome.messagesUnread > 0 && <span className="badge">{chrome.messagesUnread}</span>}</div>
              <div className="pl-2">
                <Link to={`${gerantPath}/messages/boite-reception`} className="sub"><Icon id="mail" />Boîte de réception</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="shield" />Vérification</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2">
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Mes documents</Link>
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Suivi de vérification</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="user" />Profil</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2"><Link to={`${gerantPath}/profil`} className="sub"><Icon id="user" />Mes informations</Link></div>
            </div>

            <div>
              <div className="grp"><Icon id="crown" className="i text-dash-brand" />Premium</div>
              <div className="pl-2"><Link to={`${gerantPath}/premium`} className="sub"><Icon id="cal" />Mon abonnement</Link></div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="mega" />Booster</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2">
                <Link to={`${gerantPath}/boosts`} className="sub"><Icon id="mega" />Campagnes</Link>
                <Link to={`${gerantPath}/boosts/new`} className="sub"><Icon id="mega" />Créer une campagne</Link>
              </div>
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

          <nav aria-label="Fil d’Ariane" className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Link to={homePath} className="hover:text-dash-navy">Accueil</Link><Icon id="right" className="i h-3 w-3" />
            <Link to={reservationsPath} className="hover:text-dash-navy">Réservations</Link><Icon id="right" className="i h-3 w-3" />
            <span className="text-dash-navy">Demandes</span>
          </nav>
          <h1 className="mt-3 text-3xl font-extrabold">Demandes de réservation</h1>
          <p className="mt-1 text-sm text-slate-500">Gérez les demandes de réservation et confirmez ou refusez selon la disponibilité de vos chambres.</p>

          {(error || loading) && (
            <p role={error ? 'alert' : undefined} className={`mt-4 text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>
              {error || 'Chargement de vos demandes...'}
            </p>
          )}

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-4">
              <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => changeTab('toutes')} className={`tab ${tab === 'toutes' ? 'border-dash-brand bg-dash-brand text-white' : 'border-slate-200 bg-white'}`} aria-pressed={tab === 'toutes'}>Toutes <b className={tab === 'toutes' ? 'bg-white/25' : 'bg-slate-100'}>{counts.toutes}</b></button>
                  <button type="button" onClick={() => changeTab('en_attente')} className={`tab ${tab === 'en_attente' ? 'border-dash-brand bg-dash-brand text-white' : 'border-sky-100 bg-sky-50'}`} aria-pressed={tab === 'en_attente'}>En attente <b className={tab === 'en_attente' ? 'bg-white/25' : 'bg-sky-100'}>{counts.en_attente}</b></button>
                  <button type="button" onClick={() => changeTab('confirmee')} className={`tab ${tab === 'confirmee' ? 'border-dash-brand bg-dash-brand text-white' : 'border-emerald-100 bg-emerald-50 text-emerald-600'}`} aria-pressed={tab === 'confirmee'}>Confirmées <b className={tab === 'confirmee' ? 'bg-white/25' : 'bg-emerald-100'}>{counts.confirmee}</b></button>
                  <button type="button" onClick={() => changeTab('annulee')} className={`tab ${tab === 'annulee' ? 'border-dash-brand bg-dash-brand text-white' : 'border-red-100 bg-red-50 text-red-500'}`} aria-pressed={tab === 'annulee'}>Refusées <b className={tab === 'annulee' ? 'bg-white/25' : 'bg-red-100'}>{counts.annulee}</b></button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="field"><select aria-label="Chambre" value={roomFilter} onChange={(event) => changeRoom(event.target.value)}><option value="all">Toutes les chambres</option>{roomOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select><Icon id="down" /></div>
                  <button type="button" className="field gap-3 px-4 py-3"><Icon id="cal" className="i h-4 w-4" />{period || 'Aucune période'}</button>
                </div>
              </div>

              <section className="card p-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead>
                      <tr>
                        <th className="th">Demandeur</th>
                        <th className="th">Chambre demandée</th>
                        <th className="th">Dates &amp; durée</th>
                        <th className="th">Montant estimé</th>
                        <th className="th">Statut</th>
                        <th className="th">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr]:border-t [&>tr]:border-slate-100 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
                      {!loading && !error && paged.length === 0 && (
                        <tr><td colSpan={6} className="text-center text-slate-500">{reservations.length === 0 ? 'Aucune demande de réservation pour le moment.' : 'Aucune demande ne correspond à vos filtres.'}</td></tr>
                      )}
                      {paged.map((reservation) => {
                        const room = roomsById.get(reservation.roomId) ?? null;
                        const statut = statutOf(reservation);
                        const nights = nightsOf(reservation);
                        return (
                          <tr key={reservation.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <span className="avatar h-12 w-12 text-sm">{initialsOf(reservation.clientName)}</span>
                                <div>
                                  <p className="text-[13px] font-semibold">{reservation.clientName}</p>
                                  <p className="mini">{reservation.clientEmail}</p>
                                  <p className="mini">{reservation.clientPhone || '—'}</p>
                                  <p className="mini mt-1.5"><Icon id="cal" />{formatDateTime(reservation.createdAt)}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex gap-3">
                                {room?.img ? (
                                  <img src={room.img} alt="" className="ph object-cover" />
                                ) : (
                                  <span className={`ph bg-gradient-to-br ${gradientOf(reservation.id)}`}></span>
                                )}
                                <div>
                                  <p className="font-semibold leading-snug">{room?.title ?? reservation.roomTitle}</p>
                                  <p className="mini">{[room?.quartier, room?.ville].filter(Boolean).join(', ') || '—'}</p>
                                  <p className="mini"><Icon id="bed" />{room ? roomsLabel(room.chambres) : '—'} &nbsp;<Icon id="drop" />{room ? bathsLabel(room.douches) : '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-[11px] text-slate-600">
                              <p>Du {formatShort(reservation.dateDebut)} au {formatShort(reservation.dateFin)}</p>
                              <p>{nightsLabel(nights)}</p>
                              <p className="mt-2"><Icon id="user" className="i -mt-0.5 mr-1 inline h-3 w-3" />—</p>
                            </td>
                            <td className="font-semibold">{formatPrice(reservation.montant)}<br />FCFA</td>
                            <td><span className={`pill ${statutClass[statut]}`}>{statutLabels[reservation.statut]}</span></td>
                            <td>
                              <div className="flex items-center gap-3">
                                <button type="button" className={reservation.id === selectedId ? 'vd on' : 'vd'} onClick={() => setSelectedId(reservation.id)}>Voir détails</button>
                                <button type="button" className="more" aria-label="Plus d’actions"><Icon id="dots" className="i h-5 w-5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="pg" aria-label="Page précédente"><Icon id="left" className="i h-3.5 w-3.5" /></button>
                    {pageNumbers.map((number) => (
                      <button key={number} type="button" onClick={() => setPage(number)} className={`pg ${number === currentPage ? '!bg-dash-brand font-semibold !text-white' : ''}`} aria-current={number === currentPage ? 'page' : undefined}>{number}</button>
                    ))}
                    {totalPages > pageNumbers.length && <span className="pg">…</span>}
                    <button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="pg" aria-label="Page suivante"><Icon id="right" className="i h-3.5 w-3.5" /></button>
                  </div>
                  <p className="mini">{filtered.length} demande{filtered.length > 1 ? 's' : ''} au total</p>
                </nav>
              </section>
            </div>

            <aside className="card p-5 xl:sticky xl:top-4">
              <div className="flex items-center justify-between text-xs font-medium">
                <Link to={reservationsPath} className="flex items-center gap-2"><Icon id="back" className="i h-4 w-4" />Retour à la liste</Link>
                <button type="button" className="more" aria-label="Plus d’actions"><Icon id="dots" className="i h-5 w-5" /></button>
              </div>

              {selected ? (
                <>
                  <span className={`pill ${statutClass[statutOf(selected)]} mt-4 inline-flex items-center gap-2 !font-medium`}><Icon id="clock" className="i h-3.5 w-3.5" />{statutLabels[selected.statut]}</span>

                  <div className="mt-4 flex items-center gap-4 border-b border-slate-100 pb-5">
                    <span className="avatar h-16 w-16 text-lg">{initialsOf(selected.clientName)}</span>
                    <div>
                      <p className="text-lg font-bold">{selected.clientName}</p>
                      <p className="mini mt-1"><Icon id="mail" />{selected.clientEmail}</p>
                      <p className="mini mt-1"><Icon id="phone" />{selected.clientPhone || '—'}</p>
                      <p className="mini mt-1"><Icon id="cal" />Demande le {formatDateTime(selected.createdAt)}</p>
                    </div>
                  </div>

                  <h3 className="h3">Chambre demandée</h3>
                  <div className="flex gap-4">
                    {selectedRoom?.img ? (
                      <img src={selectedRoom.img} alt="" className="ph !h-16 !w-[4.5rem] object-cover" />
                    ) : (
                      <span className={`ph !h-16 !w-[4.5rem] bg-gradient-to-br ${gradientOf(selected.id)}`}></span>
                    )}
                    <div className="text-xs">
                      <p className="font-semibold leading-snug">{selectedRoom?.title ?? selected.roomTitle}</p>
                      <p className="mini mt-1"><Icon id="pin" />{[selectedRoom?.quartier, selectedRoom?.ville].filter(Boolean).join(', ') || '—'}</p>
                      <p className="mini"><Icon id="bed" />{selectedRoom ? roomsLabel(selectedRoom.chambres) : '—'} &nbsp;<Icon id="drop" />{selectedRoom ? bathsLabel(selectedRoom.douches) : '—'}</p>
                    </div>
                  </div>

                  <h3 className="h3">Période de séjour</h3>
                  <div className="flex items-center gap-3">
                    <span className="circ"><Icon id="cal" className="i h-5 w-5" /></span>
                    <div className="text-sm"><p className="font-medium">Du {formatShort(selected.dateDebut)} au {formatShort(selected.dateFin)}</p><p className="mt-1 text-xs text-slate-600">{nightsLabel(nightsOf(selected))} · —</p></div>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <span className="circ"><Icon id="coin" className="i h-5 w-5" /></span>
                    <div><p className="text-xs font-semibold">Montant estimé</p><p className="mt-1 text-sm font-medium">{formatPrice(selected.montant)} FCFA</p></div>
                  </div>

                  <h3 className="h3">Message du client</h3>
                  <blockquote className="flex gap-3 rounded-xl bg-sky-50 p-4 text-xs leading-relaxed text-slate-600">
                    <Icon id="quote" className="i h-4 w-4 shrink-0 text-sky-400" />
                    <p>Aucun message joint à cette demande.</p>
                  </blockquote>

                  {actionError && <p role="alert" className="mt-4 text-xs font-semibold text-red-600">{actionError}</p>}
                  {actionMessage && <p className="mt-4 text-xs font-semibold text-emerald-600">{actionMessage}</p>}

                  <button type="button" onClick={() => changeStatut('confirmee')} disabled={updating} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-dash-brand py-3 text-xs font-semibold text-white shadow-lg shadow-orange-200 hover:bg-dash-brand-dark disabled:opacity-60"><Icon id="check" className="i h-4 w-4 !stroke-[2.5]" />{updating ? 'Mise à jour...' : 'Confirmer la réservation'}</button>
                  <button type="button" onClick={() => changeStatut('annulee')} disabled={updating} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-400 bg-white py-3 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"><Icon id="x" className="i h-4 w-4 !stroke-[2.5]" />Refuser la demande</button>

                  <div className="mt-5 flex gap-3 rounded-xl border border-sky-100 bg-sky-50 p-4">
                    <Icon id="info" className="i h-5 w-5 shrink-0 text-blue-600" />
                    <div><p className="text-xs font-semibold">Vérification de la disponibilité</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">Assurez-vous que la chambre est disponible pour les dates demandées avant de confirmer.</p></div>
                  </div>
                </>
              ) : (
                <div className="mt-10 text-center text-sm text-slate-500">
                  <Icon id="quote" className="i mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold">Aucune demande sélectionnée</p>
                  <p className="mt-1 text-xs">Sélectionnez une demande dans la liste pour afficher ses détails.</p>
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
