import { useMemo, useState } from 'react';
import type { ClientMineReservationData } from '../../lib/api';

// Icône inline (lucide) fidèle à la maquette.
function Ic({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const DAY = 86_400_000;

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

const STATUT_COLORS: Record<string, string> = {
  confirmee: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  en_cours: 'bg-orange-100 text-orange-700 border-orange-200',
  terminee: 'bg-slate-100 text-slate-600 border-slate-200',
  en_attente: 'bg-amber-100 text-amber-700 border-amber-200',
  annulee: 'bg-red-100 text-red-600 border-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  confirmee: 'Confirmée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  en_attente: 'En attente',
  annulee: 'Annulée',
};

function statutOf(r: ClientMineReservationData): string {
  const s = (r.statut || '').toLowerCase();
  if (s.includes('annul')) return 'annulee';
  if (s.includes('confirm') || s.includes('paid')) return 'confirmee';
  if (s.includes('cours') || s.includes('progress')) return 'en_cours';
  if (s.includes('termin') || s.includes('done') || s.includes('complete')) return 'terminee';
  return 'en_attente';
}

interface Props {
  reservations: ClientMineReservationData[];
  todayIso: string;
}


export default function ClientReservationsCalendar({
  reservations,
  todayIso,
}: Props) {
  const today = new Date();
  const todayIsoLocal = isoOf(today);
  const effectiveTodayIso = todayIso || todayIsoLocal;

  const [viewDate, setViewDate] = useState(() => new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  const monthStartTs = Date.UTC(year, month, 1);
  const monthNextTs = Date.UTC(year, month + 1, 1);
  const monthStartIso = utcToIso(monthStartTs);
  const monthEndIso = utcToIso(monthNextTs - DAY);
  const monthLabel = new Date(monthStartTs)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(/^./, (letter) => letter.toUpperCase());

  const firstWeekday = (new Date(monthStartTs).getUTCDay() + 6) % 7;
  const gridStartTs = monthStartTs - firstWeekday * DAY;

  const weeks = useMemo(() => {
    return Array.from({ length: 6 }, (_, weekIndex) => {
      const startTs = gridStartTs + weekIndex * 7 * DAY;
      const startIso = utcToIso(startTs);
      const endIso = utcToIso(startTs + 6 * DAY);
      const days = Array.from({ length: 7 }, (_, dayIndex) => {
        const ts = startTs + dayIndex * DAY;
        const date = new Date(ts);
        const iso = utcToIso(ts);
        const dayNumber = date.getUTCDate();
        const inMonth = iso >= monthStartIso && iso <= monthEndIso;
        const isToday = iso === effectiveTodayIso;
        const dayReservations = reservations.filter(
          (r) => {
            const s = r.date_debut;
            const e = r.date_fin;
            return s && e && s <= iso && iso < e && statutOf(r) !== 'annulee';
          }
        );
        return { iso, dayNumber, inMonth, isToday, reservations: dayReservations };
      });
      return { startIso, endIso, days };
    });
  }, [gridStartTs, monthStartIso, monthEndIso, effectiveTodayIso, reservations]);

  function changeMonth(offset: number) {
    setViewDate(new Date(Date.UTC(year, month + offset, 1)));
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Mois précédent"
        >
          <Ic d="m15 18-6-6 6-6" className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-bold text-slate-900">{monthLabel}</h3>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Mois suivant"
        >
          <Ic d="m9 18 6-6-6-6" className="w-4 h-4" />
        </button>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(STATUT_LABELS).map(([key, label]) => (
          <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${STATUT_COLORS[key]}`}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60" />
            {label}
          </span>
        ))}
      </div>

      {/* En-tête des jours */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, wi) =>
          week.days.map((day, di) => (
            <div
              key={`${wi}-${di}`}
              onClick={() => day.inMonth && setSelectedDay(day.iso)}
              className={`relative min-h-[70px] overflow-hidden rounded-lg border cursor-pointer ${
                day.inMonth ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent text-slate-300'
              } ${day.isToday ? 'ring-2 ring-[#FF6A13]' : ''} ${selectedDay === day.iso ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* Image de fond si une réservation occupe ce jour */}
              {day.reservations.length > 0 && day.reservations[0].room?.img && (
                <img
                  src={day.reservations[0].room.img}
                  alt={day.reservations[0].room.alt || day.reservations[0].room_title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              )}
              {/* Overlay gradient pour lisibilité */}
              {day.reservations.length > 0 && day.reservations[0].room?.img && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              )}
              {/* Numéro du jour */}
              <div className={`relative z-10 p-1.5 text-xs font-medium ${
                day.reservations.length > 0 && day.reservations[0].room?.img
                  ? 'text-white drop-shadow'
                  : day.isToday ? 'text-[#FF6A13]' : 'text-slate-700'
              }`}>
                {day.dayNumber}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
