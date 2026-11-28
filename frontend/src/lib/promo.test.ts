import { describe, expect, it } from 'vitest';
import { promoTotals } from './promo';

const room = {
  price_num: 5000,
  price_unit: '/ nuit',
  promo_group: 'promo_10',
  promo_start: '2020-01-01',
  promo_end: '2099-01-01',
  promo_min_nights: 3,
  promo_max_nights: 10,
};

describe('promoTotals (frontend)', () => {
  it('calcule le même total que le backend', () => {
    expect(promoTotals(room, 4, new Date('2026-06-01'))).toEqual({
      base: 20000,
      rate: 10,
      discount: 2000,
      total: 18000,
    });
  });

  it('retombe sur le prix plein sans promo active', () => {
    expect(promoTotals(room, 2, new Date('2026-06-01')).total).toBe(10000);
    expect(promoTotals({ ...room, promo_group: null }, 4).total).toBe(20000);
  });
});
