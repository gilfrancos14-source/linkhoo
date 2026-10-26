import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { fetchMyRooms, type Room } from '../../data/rooms';
import { getReservations, statutLabels, type Reservation } from '../../lib/reservations';

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

const DAY = 86_400_000;

type CalendarView = 'month' | 'week' | 'day';

const VIEW_OPTIONS: { id: CalendarView; label: string }[] = [
  { id: 'month', label: 'Mois' },
  { id: 'week', label: 'Semaine' },
  { id: 'day', label: 'Jour' },
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcToIso(ts: number): string {
  const date = new Date(ts);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function isoToTs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function diffDays(fromIso: string, toIso: string): number {
  return Math.round((isoToTs(toIso) - isoToTs(fromIso)) / DAY);
}

function formatShort(iso: string): string {
  if (!iso) return '';
  return new Date(isoToTs(iso)).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

function nightsOf(reservation: Reservation): number {
  const nights = diffDays(reservation.dateDebut, reservation.dateFin);
  return Number.isFinite(nights) && nights > 0 ? nights : 1;
}

function nightsLabel(count: number): string {
  return `${count} nuit${count > 1 ? 's' : ''}`;
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

function statutPillClass(statut: Reservation['statut']): string {
  if (statut === 'confirmee') return 'bg-emerald-100 text-emerald-700';
  if (statut === 'annulee') return 'bg-red-100 text-red-600';
  return 'bg-orange-100 text-brand-dark';
}

function barClass(reservation: Reservation, todayIso: string): string {
  if (reservation.statut === 'annulee') return 'bar b-no';
  if (reservation.statut === 'en_attente') return 'bar b-wait';
  if (reservation.dateDebut <= todayIso && todayIso < reservation.dateFin) return 'bar b-stay';
  return 'bar b-ok';
}

export default function CalendrierMaq5() {
  const homePath = useHomePath();
  const chrome = useGerantChrome();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const reservationsPath = `${gerantPath}/reservations`;
  const demandesPath = `${reservationsPath}/demandes`;
  const calendrierPath = `${reservationsPath}/calendrier`;

  const today = new Date();
  const todayIso = isoOf(today);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const [viewDate, setViewDate] = useState(() => new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reservationsError, setReservationsError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchMyRooms(), getReservations()])
      .then(([roomsResult, reservationsResult]) => {
        if (!alive) return;

        if (roomsResult.status === 'fulfilled') {
          const roomItems = roomsResult.value;
          setRooms(roomItems);
          setSelectedRoomId((current) =>
            current && roomItems.some((room) => room.id === current) ? current : roomItems[0]?.id ?? '',
          );
        } else {
          setError('Impossible de charger vos chambres.');
        }

        if (reservationsResult.status === 'fulfilled') {
          setReservations(reservationsResult.value);
        } else {
          const status = (reservationsResult.reason as { status?: number } | null)?.status;
          setReservationsError(
            status === 403
              ? 'Les réservations sont visibles uniquement pour les gérants vérifiés et Premium.'
              : 'Impossible de charger les réservations.',
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

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const roomReservations = reservations.filter((reservation) => reservation.roomId === selectedRoomId);

  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  const anchorTs = Date.UTC(year, month, viewDate.getUTCDate());
  const anchorIso = utcToIso(anchorTs);
  const monthStartTs = Date.UTC(year, month, 1);
  const monthNextTs = Date.UTC(year, month + 1, 1);
  const monthStartIso = utcToIso(monthStartTs);
  const monthEndIso = utcToIso(monthNextTs - DAY);
  const monthLabel = new Date(monthStartTs)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(/^./, (letter) => letter.toUpperCase());

  const firstWeekday = (new Date(monthStartTs).getUTCDay() + 6) % 7;
  const gridStartTs = monthStartTs - firstWeekday * DAY;
  const weekStartTs = anchorTs - ((new Date(anchorTs).getUTCDay() + 6) % 7) * DAY;
  const weekEndTs = weekStartTs + 6 * DAY;

  function buildWeek(startTs: number, dimOutsideMonth: boolean) {
    const startIso = utcToIso(startTs);
    const endIso = utcToIso(startTs + 6 * DAY);
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const ts = startTs + dayIndex * DAY;
      const date = new Date(ts);
      const iso = utcToIso(ts);
      const dayNumber = date.getUTCDate();
      const inMonth = iso >= monthStartIso && iso <= monthEndIso;
      const isToday = iso === todayIso;
      const reserved = roomReservations.some(
        (reservation) =>
          reservation.statut !== 'annulee' &&
          reservation.dateDebut <= iso &&
          iso < reservation.dateFin,
      );
      return {
        iso,
        dayNumber,
        inMonth: dimOutsideMonth ? inMonth : true,
        isToday,
        available: (dimOutsideMonth ? inMonth : true) && !!selectedRoom?.disponible && !reserved,
      };
    });

    const bars = roomReservations
      .filter((reservation) => reservation.dateDebut <= endIso && reservation.dateFin >= startIso)
      .map((reservation) => {
        const start = reservation.dateDebut > startIso ? reservation.dateDebut : startIso;
        const end = reservation.dateFin < endIso ? reservation.dateFin : endIso;
        const colStart = diffDays(startIso, start) + 1;
        const span = Math.max(1, diffDays(start, end) + 1);
        return { reservation, colStart, span };
      });

    return { startIso, days, bars };
  }

  const weeks = Array.from({ length: 6 }, (_, weekIndex) =>
    buildWeek(gridStartTs + weekIndex * 7 * DAY, true),
  );
  const currentWeek = buildWeek(weekStartTs, false);

  const activeReservations = roomReservations.filter((reservation) => reservation.statut !== 'annulee');
  const periodStartTs = viewMode === 'month' ? monthStartTs : viewMode === 'week' ? weekStartTs : anchorTs;
  const periodNextTs =
    viewMode === 'month' ? monthNextTs : viewMode === 'week' ? weekStartTs + 7 * DAY : anchorTs + DAY;
  const periodStartIso = utcToIso(periodStartTs);
  const periodNextIso = utcToIso(periodNextTs);
  const periodEndIso = utcToIso(periodNextTs - DAY);
  const periodTotalNights = diffDays(periodStartIso, periodNextIso);
  const periodReservations = activeReservations.filter(
    (reservation) => reservation.dateDebut <= periodEndIso && reservation.dateFin >= periodStartIso,
  );

  const periodOccupiedNights = activeReservations.reduce((sum, reservation) => {
    const start = reservation.dateDebut > periodStartIso ? reservation.dateDebut : periodStartIso;
    const end = reservation.dateFin < periodNextIso ? reservation.dateFin : periodNextIso;
    const nights = diffDays(start, end);
    return sum + (Number.isFinite(nights) && nights > 0 ? nights : 0);
  }, 0);
  const periodAvailableNights = Math.max(0, periodTotalNights - periodOccupiedNights);
  const periodOccupancy =
    periodTotalNights > 0 ? Math.round((periodOccupiedNights / periodTotalNights) * 100) : 0;

  const todayReservations = activeReservations.filter(
    (reservation) => reservation.dateDebut <= todayIso && todayIso < reservation.dateFin,
  );
  const dayReservations = activeReservations.filter(
    (reservation) => reservation.dateDebut <= anchorIso && anchorIso < reservation.dateFin,
  );
  const dayStatusLabel = !selectedRoom
    ? 'Aucune chambre'
    : dayReservations.length > 0
      ? 'Réservé'
      : selectedRoom.disponible
        ? 'Disponible'
        : 'Indisponible';
  const dayStatusClass = !selectedRoom
    ? 'bg-slate-100 text-slate-500'
    : dayReservations.length > 0
      ? 'bg-orange-100 text-brand-dark'
      : selectedRoom.disponible
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-red-100 text-red-600';

  const todayLabel = today.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dayLabel = new Date(anchorTs)
    .toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .replace(/^./, (letter) => letter.toUpperCase());
  const weekLabel = `Du ${new Date(weekStartTs).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })} au ${new Date(weekEndTs).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;
  const periodLabel = viewMode === 'month' ? monthLabel : viewMode === 'week' ? weekLabel : dayLabel;
  const periodPrevLabel =
    viewMode === 'month' ? 'Mois précédent' : viewMode === 'week' ? 'Semaine précédente' : 'Jour précédent';
  const periodNextLabel =
    viewMode === 'month' ? 'Mois suivant' : viewMode === 'week' ? 'Semaine suivante' : 'Jour suivant';
  const summaryTitle =
    viewMode === 'month' ? 'Résumé du mois' : viewMode === 'week' ? 'Résumé de la semaine' : 'Résumé du jour';

  function changePeriod(offset: number) {
    if (viewMode === 'month') {
      setViewDate(new Date(Date.UTC(year, month + offset, 1)));
    } else if (viewMode === 'week') {
      setViewDate(new Date(anchorTs + offset * 7 * DAY));
    } else {
      setViewDate(new Date(anchorTs + offset * DAY));
    }
  }

  function selectView(next: CalendarView) {
    if (next === 'month') {
      setViewDate(new Date(Date.UTC(year, month, 1)));
    } else if (viewMode === 'month') {
      const sameMonth = year === today.getFullYear() && month === today.getMonth();
      setViewDate(new Date(sameMonth ? Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) : anchorTs));
    }
    setViewMode(next);
  }

  function openDay(iso: string) {
    setViewDate(new Date(isoToTs(iso)));
    setViewMode('day');
  }

  return (
    <div className="gerant-maq5 bg-[#f5f8fc] text-navy antialiased">
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
        <symbol id="bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></symbol>
        <symbol id="doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
        <symbol id="okdoc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 14l2 2 4-4" /></symbol>
        <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
        <symbol id="list" viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></symbol>
        <symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
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
              <div className="grp"><Icon id="cal" className="i text-navy" />Réservations{chrome.reservationsCount > 0 && <span className="badge">{chrome.reservationsCount}</span>}</div>
              <div className="pl-2">
                <Link to={demandesPath} className="sub"><Icon id="user" />Demandes</Link>
                <Link to={calendrierPath} className="sub on" aria-current="page"><Icon id="cal" />Calendrier</Link>
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
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="okdoc" />Suivi de vérification</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="user" />Profil</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2"><Link to={`${gerantPath}/profil`} className="sub"><Icon id="user" />Mes informations</Link></div>
            </div>

            <div>
              <div className="grp"><Icon id="crown" className="i text-brand" />Premium</div>
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

          <div className="mt-auto rounded-2xl border border-orange-100 bg-brand-soft p-4 pt-5">
            <p className="flex items-center gap-2 text-sm font-bold"><Icon id="crown" className="i h-5 w-5 text-brand" />Passez au Premium</p>
            <p className="mt-2 text-[11px] text-slate-500">Plus de visibilité, plus de réservations !</p>
            <Link to={`${gerantPath}/premium`} className="mt-3 block rounded-lg bg-brand py-2 text-center text-xs font-semibold text-white hover:bg-brand-dark">Voir les avantages</Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-7">
          <header className="flex items-center gap-4">
            <label className="card flex max-w-3xl flex-1 items-center gap-3 px-5 py-3 text-slate-400">
              <Icon id="search" className="i h-5 w-5" />
              <input type="search" placeholder="Rechercher une chambre, une catégorie…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <button type="button" className="relative ml-auto p-2 text-navy" aria-label="Notifications">
              <Icon id="bell" className="i h-6 w-6" />
              {chrome.messagesUnread > 0 && <span className="absolute right-0.5 top-0 grid h-4 w-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{chrome.messagesUnread}</span>}
            </button>
            <div className="card flex items-center gap-3 py-2 pl-2 pr-4">
              <span className="avatar h-10 w-10 text-xs">{chrome.initials}</span>
              <div className="hidden text-xs sm:block"><p className="font-semibold">{chrome.displayName}</p><p className="text-slate-400">Gérant</p></div>
              <GerantLogoutButton className="ml-1" />
            </div>
          </header>

          <nav aria-label="Fil d’Ariane" className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Link to={homePath} className="hover:text-navy">Accueil</Link><Icon id="right" className="i h-3 w-3" /><Link to={reservationsPath} className="hover:text-navy">Réservations</Link><Icon id="right" className="i h-3 w-3" /><span className="text-navy">Calendrier</span>
          </nav>
          <h1 className="mt-3 text-3xl font-extrabold">Calendrier des réservations</h1>
          <p className="mt-1 text-sm text-slate-500">Visualisez la disponibilité de vos chambres et gérez vos réservations en un coup d’œil.</p>

          {(error || loading) && (
            <p role={error ? 'alert' : undefined} className={`mt-4 text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>
              {error || 'Chargement de votre calendrier...'}
            </p>
          )}

          {reservationsError && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {reservationsError}
            </p>
          )}

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_330px]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <div className="card flex items-center gap-4 p-4">
                  {selectedRoom?.img ? (
                    <img src={selectedRoom.img} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-12 w-16 shrink-0 rounded-lg bg-gradient-to-br from-sky-300 to-amber-200"></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{selectedRoom?.title ?? 'Aucune chambre'}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {selectedRoom
                        ? `${[selectedRoom.quartier, selectedRoom.ville].filter(Boolean).join(', ')} • ${selectedRoom.chambres} chambre${selectedRoom.chambres > 1 ? 's' : ''}`
                        : 'Ajoutez une chambre pour afficher son calendrier.'}
                    </span>
                  </span>
                  <select
                    aria-label="Choisir une chambre"
                    value={selectedRoomId}
                    onChange={(event) => setSelectedRoomId(event.target.value)}
                    disabled={rooms.length === 0}
                    className="max-w-[11rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-navy outline-none"
                  >
                    {rooms.length === 0 && <option value="">Aucune chambre</option>}
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.title}</option>
                    ))}
                  </select>
                </div>
                <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => changePeriod(-1)} className="nav-btn" aria-label={periodPrevLabel}><Icon id="left" className="i h-4 w-4" /></button>
                    <p className="min-w-[8.5rem] text-center text-sm font-bold">{periodLabel}</p>
                    <button type="button" onClick={() => changePeriod(1)} className="nav-btn" aria-label={periodNextLabel}><Icon id="right" className="i h-4 w-4" /></button>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Vue">
                    {VIEW_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`seg${viewMode === option.id ? ' on' : ''}`}
                        aria-pressed={viewMode === option.id}
                        onClick={() => selectView(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <section className="card p-4">
                {rooms.length === 0 && (
                  <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    Aucune chambre enregistrée. Ajoutez une chambre pour visualiser ses réservations dans le calendrier.
                  </p>
                )}
                {viewMode === 'day' ? (
                  <div className="p-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">{dayLabel}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedRoom ? selectedRoom.title : 'Aucune chambre sélectionnée'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dayStatusClass}`}>
                        {dayStatusLabel}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {dayReservations.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                          Aucune réservation pour cette date.
                        </p>
                      ) : (
                        dayReservations.map((reservation) => (
                          <Link
                            key={reservation.id}
                            to={demandesPath}
                            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
                          >
                            <span className="avatar h-10 w-10 text-xs">{initialsOf(reservation.clientName)}</span>
                            <div className="min-w-0 flex-1 text-xs">
                              <p className="text-sm font-semibold">{reservation.clientName}</p>
                              <p className="mt-1 text-slate-500">
                                {formatShort(reservation.dateDebut)} → {formatShort(reservation.dateFin)} •{' '}
                                {nightsLabel(nightsOf(reservation))} • {reservation.roomTitle}
                              </p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statutPillClass(reservation.statut)}`}>
                              {statutLabels[reservation.statut]}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-7 border-b border-slate-100 py-3 text-center text-xs font-semibold">
                        <span>Lundi</span><span>Mardi</span><span>Mercredi</span><span>Jeudi</span><span>Vendredi</span><span>Samedi</span><span>Dimanche</span>
                      </div>

                      {(viewMode === 'month' ? weeks : [currentWeek]).map((week) => (
                        <div className="week" key={week.startIso}>
                          {week.days.map((day) => (
                            <button
                              type="button"
                              key={day.iso}
                              onClick={() => openDay(day.iso)}
                              aria-label={`Voir le détail du ${day.iso}`}
                              className={`day text-left${day.inMonth ? '' : ' mut'}${day.isToday ? ' today' : ''}`}
                            >
                              {day.isToday ? (
                                <b className="grid h-6 w-6 place-items-center rounded-full bg-brand text-white">{day.dayNumber}</b>
                              ) : (
                                day.dayNumber
                              )}
                              {day.available && <span className="avail">Disponible</span>}
                            </button>
                          ))}
                          {week.bars.length > 0 && (
                            <div className="ov">
                              {week.bars.map(({ reservation, colStart, span }) => (
                                <Link
                                  key={`${week.startIso}-${reservation.id}`}
                                  to={demandesPath}
                                  className={barClass(reservation, todayIso)}
                                  style={{ gridColumn: `${colStart} / span ${span}` }}
                                >
                                  <span><b>{reservation.clientName}</b><small>{nightsLabel(nightsOf(reservation))}</small></span>
                                  {selectedRoom && <em>{selectedRoom.chambres} chambre{selectedRoom.chambres > 1 ? 's' : ''}</em>}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ul className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-2 text-xs">
                  <li className="flex items-center gap-2"><span className="dot bg-emerald-500"></span>Confirmée</li>
                  <li className="flex items-center gap-2"><span className="dot bg-amber-400"></span>En attente</li>
                  <li className="flex items-center gap-2"><span className="dot bg-red-500"></span>Refusée</li>
                  <li className="flex items-center gap-2"><span className="dot bg-blue-500"></span>En séjour</li>
                  <li className="flex items-center gap-2"><span className="dot bg-violet-500"></span>Autre</li>
                </ul>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="card p-5">
                <h2 className="mb-4 font-bold">{summaryTitle}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="tile"><span className="bg-orange-100 text-brand"><Icon id="cal" className="i h-5 w-5" /></span><div><p>{periodReservations.length}</p><p>Réservations</p></div></div>
                  <div className="tile"><span className="bg-sky-100 text-blue-600"><Icon id="bed" className="i h-5 w-5" /></span><div><p>{periodOccupiedNights}</p><p>Nuits occupées</p></div></div>
                  <div className="tile"><span className="bg-emerald-100"><i className="h-4 w-4 rounded-full border-2 border-emerald-500"></i></span><div><p>{periodAvailableNights}</p><p>Nuits disponibles</p></div></div>
                  <div className="tile"><span className="bg-emerald-100 text-xs font-bold text-emerald-600">%</span><div><p>{periodOccupancy}%</p><p>Taux d’occupation</p></div></div>
                </div>
              </section>

              <section className="card p-5">
                <h2 className="mb-4 font-bold">Légende</h2>
                <ul className="space-y-4 text-xs">
                  <li className="flex items-center gap-3"><span className="dot bg-emerald-500"></span>Réservation confirmée</li>
                  <li className="flex items-center gap-3"><span className="dot bg-amber-400"></span><span><span className="text-brand-dark">En attente</span> de confirmation</span></li>
                  <li className="flex items-center gap-3"><span className="dot bg-red-500"></span>Demande refusée</li>
                  <li className="flex items-center gap-3"><span className="dot bg-blue-500"></span>Séjour en cours</li>
                  <li className="flex items-center gap-3"><span className="dot bg-violet-500"></span>Autre (maintenance, etc.)</li>
                </ul>
              </section>

              <section className="flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <Icon id="bulb" className="i h-5 w-5 shrink-0 text-sky-500" />
                <div><p className="text-xs font-semibold text-blue-600">Astuce</p><p className="mt-1.5 text-xs leading-relaxed text-slate-600">Cliquez sur une date pour voir les détails des réservations et gérer vos disponibilités.</p></div>
              </section>

              <section className="card p-5">
                <h2 className="flex items-center gap-3 font-bold"><Icon id="cal" className="i h-5 w-5" />Aujourd’hui</h2>
                <p className="mt-2 flex items-center gap-3 text-xs text-slate-500"><span className="rounded border border-slate-300 px-1 text-[9px]">{pad(today.getDate())}</span>{todayLabel}</p>
                <h3 className="mb-3 mt-4 text-xs font-bold">Réservations du jour</h3>
                {todayReservations.length === 0 && (
                  <p className="text-xs text-slate-500">Aucune réservation aujourd’hui{selectedRoom ? ` pour ${selectedRoom.title}` : ''}.</p>
                )}
                {todayReservations.map((reservation) => (
                  <div key={reservation.id} className="relative mt-3 flex items-center gap-3 rounded-xl border border-slate-100 p-3 first:mt-0">
                    {selectedRoom?.img ? (
                      <img src={selectedRoom.img} alt="" className="h-11 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="h-11 w-12 shrink-0 rounded-lg bg-gradient-to-br from-sky-300 to-amber-200"></span>
                    )}
                    <div className="text-xs"><p className="font-semibold">{reservation.clientName}</p><p className="mt-1 text-[11px] text-slate-500">{nightsLabel(nightsOf(reservation))} • {formatShort(reservation.dateDebut)} → {formatShort(reservation.dateFin)}</p></div>
                    <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${reservation.statut === 'confirmee' ? 'bg-emerald-100 text-emerald-700' : reservation.statut === 'annulee' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-brand-dark'}`}>{statutLabels[reservation.statut]}</span>
                  </div>
                ))}
                <Link to={demandesPath} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-dark">Voir toutes les réservations <Icon id="arrow" className="i h-3.5 w-3.5" /></Link>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
