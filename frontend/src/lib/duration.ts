export type DureeUnite = 'nuit' | 'mois';

export const DUREE_MAX_NUIT = 366;
export const DUREE_MAX_MOIS = 24;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const dt = new Date(parsed);
  const [y, m, d] = value.split('-').map(Number);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

export function maxDuree(unite: DureeUnite): number {
  return unite === 'mois' ? DUREE_MAX_MOIS : DUREE_MAX_NUIT;
}

export function unitFromPriceUnit(priceUnit: string): DureeUnite {
  return priceUnit === '/ mois' ? 'mois' : 'nuit';
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  if (!isValidDateStr(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return toIsoDate(new Date(Date.UTC(y, m - 1, d) + days * 86_400_000));
}

export function addMonths(dateStr: string, months: number): string {
  if (!isValidDateStr(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return toIsoDate(
    new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay))),
  );
}

export function computeDateFin(dateDebut: string, dureeNombre: number, unite: DureeUnite): string {
  return unite === 'mois'
    ? addMonths(dateDebut, dureeNombre)
    : addDays(dateDebut, dureeNombre);
}

export function nightsBetween(dateDebut: string, dateFin: string): number | null {
  const start = Date.parse(dateDebut);
  const end = Date.parse(dateFin);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const nights = Math.round((end - start) / 86_400_000);
  return Number.isFinite(nights) ? nights : null;
}

export function pluralDuree(dureeNombre: number, unite: DureeUnite): string {
  if (unite === 'mois') return `${dureeNombre} mois`;
  return `${dureeNombre} ${dureeNombre > 1 ? 'nuits' : 'nuit'}`;
}
