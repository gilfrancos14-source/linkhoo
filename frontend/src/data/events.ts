import type { MarketCode } from '../contexts/MarketContext';
import { apiEvents, type EventData } from '../lib/api';

export interface Event {
  id: string;
  market: MarketCode;
  city: string;
  title: string;
  description: string;
  eventDate: string;
  img: string;
  alt: string;
}

export interface CityGroup {
  city: string;
  marker: MarketCode;
  cover: Event;
  events: Event[];
}

const FALLBACK_IMG = '/images/pexels-artbovich-7214173.jpg';

function mapEvent(d: EventData): Event {
  return {
    id: d.id,
    market: d.market,
    city: d.city,
    title: d.title,
    description: d.description,
    eventDate: d.event_date,
    img: d.img || FALLBACK_IMG,
    alt: d.alt || d.title,
  };
}

export async function fetchEventsByMarket(market: MarketCode): Promise<Event[]> {
  const data = await apiEvents.list(market);
  return data
    .map(mapEvent)
    .sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : a.id < b.id ? -1 : 1));
}

// Un `DATE` Postgres est renvoyé en « YYYY-MM-DD ». new Date('YYYY-MM-DD')
// interprète cette valeur comme minuit UTC : dans un fuseau négatif,
// toLocaleDateString afficherait le jour précédent. On parse donc en local.
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// « 12 octobre » / « 3 janvier » — cohérent avec ProfilPage/PremiumPage.
export function formatEventDate(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// Jours jusqu'à l'événement : négatif = passé.
export function daysUntil(isoDate: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseLocalDate(isoDate).getTime() - today.getTime()) / 86400000);
}

// Décale une date ISO « YYYY-MM-DD » de `days` jours en calcul local, puis la
// re-sérialise sans passer par toISOString (qui décalerait d'un jour en UTC-).
export function shiftIsoDate(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Couverture d'une ville = l'événement le plus proche à venir. S'il n'en reste
// aucun, on retombe sur le plus récent. Le minimum est cherché par date (et
// non en prenant le premier élément) : la couverture ne dépend alors pas de
// l'ordre de la liste reçue.
function pickCover(events: Event[]): Event {
  const upcoming = events.filter((e) => daysUntil(e.eventDate) >= 0);
  if (upcoming.length) return upcoming.reduce((best, e) => (e.eventDate < best.eventDate ? e : best));
  return events.reduce((best, e) => (e.eventDate > best.eventDate ? e : best));
}

// Une carte = une ville. Le nom de la ville vient de la colonne `events.city`,
// jamais d'une liste en dur : créer un événement dans une nouvelle ville fait
// apparaître sa carte sans modification de code.
export function groupEventsByCity(events: Event[]): CityGroup[] {
  const byCity = new Map<string, Event[]>();
  for (const e of events) {
    const list = byCity.get(e.city);
    if (list) list.push(e);
    else byCity.set(e.city, [e]);
  }

  const groups: CityGroup[] = [];
  for (const [city, list] of byCity) {
    const cover = pickCover(list);
    groups.push({ city, marker: cover.market, cover, events: list });
  }

  // Les villes dont le prochain événement est le plus proche passent en premier.
  return groups.sort((a, b) => {
    const da = daysUntil(a.cover.eventDate);
    const db = daysUntil(b.cover.eventDate);
    const ua = da >= 0 ? da : Number.MAX_SAFE_INTEGER;
    const ub = db >= 0 ? db : Number.MAX_SAFE_INTEGER;
    if (ua !== ub) return ua - ub;
    return a.city < b.city ? -1 : a.city > b.city ? 1 : 0;
  });
}
