// Arithmétique de durée de réservation.
//
// Les dates circulent en 'YYYY-MM-DD' et sont interprétées comme du calendrier
// pur en UTC : new Date('YYYY-MM-DD') = minuit UTC, calculer en heure locale
// décalerait d'un jour selon le fuseau du serveur (risque de ±1 nuit).

export type DureeUnite = 'nuit' | 'mois';

export const DUREE_MAX_NUIT = 366;
export const DUREE_MAX_MOIS = 24;

function parseYmd(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

function formatUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseYmd(dateStr);
  return formatUtc(new Date(Date.UTC(y, m - 1, d + days)));
}

// Le jour est clampé au dernier jour du mois cible : 31 janv. + 1 mois = 28/29 févr.
export function addMonths(dateStr: string, months: number): string {
  const { y, m, d } = parseYmd(dateStr);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return formatUtc(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay))));
}

export function computeDateFin(dateDebut: string, dureeNombre: number, dureeUnite: DureeUnite): string {
  return dureeUnite === 'mois' ? addMonths(dateDebut, dureeNombre) : addDays(dateDebut, dureeNombre);
}

// L'unité facturée est celle du prix défini par le gérant (rooms.price_unit).
export function unitFromPriceUnit(priceUnit: string): DureeUnite {
  return priceUnit === '/ mois' ? 'mois' : 'nuit';
}

// Montant = prix unitaire × durée. Recalculé côté serveur : la valeur envoyée
// par le client est ignorée.
export function calculateMontant(priceNum: number, dureeNombre: number): number {
  return priceNum * dureeNombre;
}
