import { describe, expect, it } from 'vitest';
import { promoTotals } from './promo';

const room = {
  price_num: 5000,
  price_unit: '/ nuit',
  promo_group: 'promo_15',
  promo_start: '2020-01-01',
  promo_end: '2099-01-01',
  promo_min_nights: 2,
  promo_max_nights: 5,
};

describe('promoTotals', () => {
  it('applique la remise quand la durée est dans la fenêtre', () => {
    const totals = promoTotals(room, 3, new Date('2026-06-01'));
    expect(totals).toEqual({ base: 15000, rate: 15, discount: 2250, total: 12750 });
  });

  it('n’applique rien hors de la fenêtre de séjour', () => {
    expect(promoTotals(room, 1, new Date('2026-06-01')).rate).toBe(0);
    expect(promoTotals(room, 6, new Date('2026-06-01')).total).toBe(30000);
  });

  it('n’applique rien hors des dates ou en location mensuelle', () => {
    expect(promoTotals({ ...room, promo_end: '2020-01-01' }, 3, new Date('2026-06-01')).rate).toBe(0);
    expect(promoTotals({ ...room, price_unit: '/ mois' }, 3, new Date('2026-06-01')).rate).toBe(0);
  });
});
