/** Miroir frontend de `backend/src/utils/promo.ts` pour l'affichage du total. */
export const PROMO_RATES: Record<string, number> = {
  promo_15: 15,
  promo_10: 10,
  promo_5: 5,
};

export interface PromoTotals {
  base: number;
  rate: number;
  discount: number;
  total: number;
}

function dateValue(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const value = raw.length === 10 ? `${raw}T23:59:59` : raw;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function promoTotals(
  room: {
    price_num: number;
    price_unit?: string | null;
    promo_group?: string | null;
    promo_start?: string | null;
    promo_end?: string | null;
    promo_min_nights?: number | null;
    promo_max_nights?: number | null;
  },
  nights: number,
  now = new Date(),
): PromoTotals {
  const base = Math.max(0, Number(room.price_num) || 0) * Math.max(0, nights);
  const rate =
    room.price_unit === '/ mois' || !room.promo_group ? 0 : PROMO_RATES[room.promo_group] ?? 0;
  if (rate === 0) return { base, rate: 0, discount: 0, total: base };

  const start = dateValue(room.promo_start);
  const end = dateValue(room.promo_end);
  if (start && start > now) return { base, rate: 0, discount: 0, total: base };
  if (end && end < now) return { base, rate: 0, discount: 0, total: base };

  const min = room.promo_min_nights;
  const max = room.promo_max_nights;
  if (min != null && nights < min) return { base, rate: 0, discount: 0, total: base };
  if (max != null && nights > max) return { base, rate: 0, discount: 0, total: base };

  const discount = Math.round(base * rate) / 100;
  return { base, rate, discount, total: base - discount };
}
