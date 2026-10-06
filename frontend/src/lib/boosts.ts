import type { BoostDisplayStatus, BoostMode } from './api';

/** Libellés français de l'état affiché (dérivé côté serveur à la lecture). */
export const boostStatusLabels: Record<BoostDisplayStatus, string> = {
  pending: 'Paiement en attente',
  scheduled: 'Programmée',
  live: 'En ligne',
  paused: 'En pause',
  ended: 'Terminée',
  exhausted: 'Budget épuisé',
  canceled: 'Annulée',
};

export const boostModeLabels: Record<BoostMode, string> = {
  cpc: 'Par clic',
  cpi: 'Par impression',
};

/** « 1 000 F » sur XOF (devise locale abrégée « F »), sinon la devise telle quelle. */
export function boostAmount(amount: number, currency = 'XOF'): string {
  const value = new Intl.NumberFormat('fr-FR').format(amount);
  return currency === 'XOF' ? `${value} F` : `${value} ${currency}`;
}

/** « du 6 oct. 2026 au 5 nov. 2026 » */
export function boostDateRange(startsAt: string, endsAt: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `du ${fmt(startsAt)} au ${fmt(endsAt)}`;
}

/** Date locale au format des champs <input type="date"> (YYYY-MM-DD). */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Fenêtre de dates de campagne : mêmes règles que le serveur
 * (boostInitiateSchema / boostScheduleSchema) — la validation serveur
 * reste la référence, ceci sert à guider l'utilisateur avant l'envoi.
 * Les jours sont interprétés à midi pour marginaliser les fuseaux.
 */
export function validateBoostWindow(startDay: string, endDay: string): string | null {
  const start = new Date(`${startDay}T12:00:00`).getTime();
  const end = new Date(`${endDay}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Date invalide';
  if (start < Date.now() - 12 * 60 * 60 * 1000) {
    return 'La date de début ne peut pas être dans le passé';
  }
  if (end <= start) return 'La date de fin doit être postérieure à la date de début';
  if (end - start > 90 * 24 * 60 * 60 * 1000) {
    return 'La campagne ne peut pas durer plus de 90 jours';
  }
  return null;
}

/** Pourcentage consommé du budget, borné à 100. */
export function boostSpentPercent(budgetTotal: number, spent: number): number {
  if (!Number.isFinite(budgetTotal) || budgetTotal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((spent / budgetTotal) * 100)));
}
