// Partition de la section Tourisme : grosses cartes vs petites cartes.
//
// Une destination est "éligible" en grosse carte si :
//   - elle est `featured` (bypass admin), ou
//   - sa ville a un événement dans les UPCOMING_WINDOW_DAYS prochains jours.
// Les éligibles sont triés (featured d'abord, puis événement le plus proche),
// les 2 premiers deviennent les grosses cartes ; tout le reste — éligible en
// surnombre ou non éligible — part en petites cartes. On ne fabrique jamais
// de carte pour compléter : 0 ou 1 éligible = 0 ou 1 grosse carte.

import { addDays } from './duration';
import { normalizeCity } from './city';

export { normalizeCity };

export const UPCOMING_WINDOW_DAYS = 30;
export const BIG_CARD_COUNT = 2;

export type DestinationRecord = {
  id: string;
  city: string;
  featured: boolean;
  created_at?: string | null;
};

// Fenêtre [aujourd'hui, aujourd'hui + 30] en calendrier UTC (YYYY-MM-DD) :
// la comparaison lexicographique de ces chaînes est une comparaison de dates.
export function upcomingWindow(today: string): { from: string; to: string } {
  return { from: today, to: addDays(today, UPCOMING_WINDOW_DAYS) };
}

// Map ville normalisée → prochain événement (au plus tôt) dans la fenêtre.
export function upcomingEventCities(
  events: { city: string; event_date: string }[],
  today: string,
): Map<string, string> {
  const { from, to } = upcomingWindow(today);
  const byCity = new Map<string, string>();
  for (const event of events) {
    if (event.event_date < from || event.event_date > to) continue;
    const key = normalizeCity(event.city);
    const current = byCity.get(key);
    if (!current || event.event_date < current) byCity.set(key, event.event_date);
  }
  return byCity;
}

function upcomingDate(destination: DestinationRecord, upcoming: Map<string, string>): string | null {
  return upcoming.get(normalizeCity(destination.city)) ?? null;
}

function isEligible(destination: DestinationRecord, upcoming: Map<string, string>): boolean {
  return destination.featured === true || upcoming.has(normalizeCity(destination.city));
}

// Tri déterministe : featured d'abord, puis événement le plus proche (sans
// événement en dernier), puis created_at et id pour que deux appels
// consécutifs renvoient le même ordre.
function compareDestinations(a: DestinationRecord, b: DestinationRecord, upcoming: Map<string, string>): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;

  const dateA = upcomingDate(a, upcoming);
  const dateB = upcomingDate(b, upcoming);
  if (dateA !== dateB) {
    if (dateA === null) return 1;
    if (dateB === null) return -1;
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
  }

  const createdA = a.created_at ?? '';
  const createdB = b.created_at ?? '';
  if (createdA !== createdB) {
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    if (createdA < createdB) return -1;
    if (createdA > createdB) return 1;
  }

  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function partitionDestinations<T extends DestinationRecord>(
  destinations: T[],
  upcoming: Map<string, string>,
): { big: T[]; small: T[] } {
  const sorted = [...destinations].sort((a, b) => compareDestinations(a, b, upcoming));
  const big = sorted.filter((destination) => isEligible(destination, upcoming)).slice(0, BIG_CARD_COUNT);
  const bigIds = new Set(big.map((destination) => destination.id));
  const small = sorted.filter((destination) => !bigIds.has(destination.id));
  return { big, small };
}
