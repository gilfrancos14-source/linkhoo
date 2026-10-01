import { describe, expect, it } from 'vitest';
import { normalizeCity } from './city';

describe('normalizeCity', () => {
  it('passe en minuscules et retire les espaces de bord', () => {
    expect(normalizeCity('  Abidjan ')).toBe('abidjan');
  });

  it('supprime les accents', () => {
    expect(normalizeCity('Bouaké')).toBe('bouake');
    expect(normalizeCity('Yamoussoukro')).toBe('yamoussoukro');
    expect(normalizeCity('San-Pédro')).toBe('sanpedro');
  });

  it('supprime espaces, tirets et ponctuation', () => {
    expect(normalizeCity('TORI BOSSITO')).toBe('toribossito');
    expect(normalizeCity('Tori-Bossito')).toBe('toribossito');
    expect(normalizeCity('Grand-Bassam')).toBe('grandbassam');
    expect(normalizeCity("Port-Nou'ville")).toBe('portnouville');
  });

  it('accepte une valeur non string (colonne Supabase / query string)', () => {
    expect(normalizeCity(undefined)).toBe('');
    expect(normalizeCity(null)).toBe('');
    expect(normalizeCity(42)).toBe('42');
  });

  it('réunit deux écritures d’une même ville', () => {
    expect(normalizeCity('San-Pédro')).toBe(normalizeCity(' SAN PEDRO '));
    expect(normalizeCity('Bouaké')).toBe(normalizeCity('bouake'));
  });
});
