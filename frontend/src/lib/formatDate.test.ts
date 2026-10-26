import { describe, expect, it } from 'vitest';
import { formatDate, formatDateLong, formatDateTimeShort } from './formatDate';

// Dates construites en heure locale : les attentes restent stables quel que
// soit le fuseau de la machine qui exécute la suite.
const OCT_5 = new Date(2026, 9, 5, 12, 0, 0);
const OCT_20 = new Date(2026, 9, 20, 10, 24, 0);

describe('formatDate', () => {
  it('formate en date courte française', () => {
    expect(formatDate(OCT_5)).toBe('05/10/2026');
  });

  it('renvoie une chaîne vide pour une valeur absente ou invalide', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('pas une date')).toBe('');
  });
});

describe('formatDateLong', () => {
  it('formate en date longue française', () => {
    expect(formatDateLong(OCT_5)).toBe('5 octobre 2026');
  });
});

describe('formatDateTimeShort', () => {
  it('ajoute l’heure après un séparateur', () => {
    expect(formatDateTimeShort(OCT_20)).toBe('20 oct. 2026 • 10:24');
  });

  it('renvoie une chaîne vide quand la date manque', () => {
    expect(formatDateTimeShort(null)).toBe('');
    expect(formatDateTimeShort('nope')).toBe('');
  });
});
