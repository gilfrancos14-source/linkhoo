import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  calculateMontant,
  computeDateFin,
  unitFromPriceUnit,
} from './duration';

describe('addDays', () => {
  it('ajoute des nuits en calendrier pur', () => {
    expect(addDays('2026-05-01', 3)).toBe('2026-05-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('traverse les années bissextiles', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('addMonths', () => {
  it('ajoute des mois en conservant le jour', () => {
    expect(addMonths('2026-05-01', 2)).toBe('2026-07-01');
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
  });

  it('clamp le jour au dernier jour du mois cible', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-05-31', 1)).toBe('2026-06-30');
  });
});

describe('computeDateFin', () => {
  it('délègue selon l’unité', () => {
    expect(computeDateFin('2026-05-01', 3, 'nuit')).toBe('2026-05-04');
    expect(computeDateFin('2026-05-01', 3, 'mois')).toBe('2026-08-01');
  });
});

describe('unitFromPriceUnit', () => {
  it('traduit le tarif du gérant en unité de durée', () => {
    expect(unitFromPriceUnit('/ nuit')).toBe('nuit');
    expect(unitFromPriceUnit('/ mois')).toBe('mois');
    expect(unitFromPriceUnit('autre chose')).toBe('nuit');
  });
});

describe('calculateMontant', () => {
  it('multiplie le prix par la durée', () => {
    expect(calculateMontant(5000, 3)).toBe(15000);
    expect(calculateMontant(120000, 2)).toBe(240000);
  });
});
