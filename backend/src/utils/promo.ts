/** Remises gérées par le gérant sur ses annonces. */
export const PROMO_RATES = {
  promo_15: 15,
  promo_10: 10,
  promo_5: 5,
} as const;

export type PromoGroup = keyof typeof PROMO_RATES;

export interface PromoRoom {
  price_num: number;
  price_unit?: string | null;
  promo_group?: string | null;
  promo_start?: string | null;
  promo_end?: string | null;
  /** Fenêtre de séjour en nuits ; null = sans contrainte. */
  promo_min_nights?: number | null;
  promo_max_nights?: number | null;
}

export interface PromoTotals {
  /** Prix unitaire × durée, avant remise. */
  base: number;
  /** Pourcentage appliqué (0 si aucune promo active). */
  rate: number;
  /** Montant de la remise. */
  discount: number;
  /** Montant réellement facturé. */
  total: number;
}

function dateValue(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const value = raw.length === 10 ? `${raw}T23:59:59` : raw;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Calcule le montant d'une réservation en appliquant la promo du gérant
 * uniquement si elle est active (dates) et si la durée du séjour est dans
 * la fenêtre déclarée. Le calcul est fait côté serveur : le montant envoyé
 * par le client n'est jamais utilisé.
 */
export function promoTotals(room: PromoRoom, dureeNombre: number, now = new Date()): PromoTotals {
  const base = Math.max(0, Number(room.price_num) || 0) * Math.max(0, dureeNombre);
  const rate =
    room.price_unit === '/ mois' || !room.promo_group
      ? 0
      : (PROMO_RATES as Record<string, number | undefined>)[room.promo_group] ?? 0;
  if (rate === 0) return { base, rate: 0, discount: 0, total: base };

  const start = dateValue(room.promo_start);
  const end = dateValue(room.promo_end);
  if (start && start > now) return { base, rate: 0, discount: 0, total: base };
  if (end && end < now) return { base, rate: 0, discount: 0, total: base };

  const min = room.promo_min_nights;
  const max = room.promo_max_nights;
  if (min != null && dureeNombre < min) return { base, rate: 0, discount: 0, total: base };
  if (max != null && dureeNombre > max) return { base, rate: 0, discount: 0, total: base };

  const discount = Math.round(base * rate) / 100;
  return { base, rate, discount, total: base - discount };
}
