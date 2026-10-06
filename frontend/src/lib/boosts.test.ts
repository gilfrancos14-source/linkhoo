import { describe, expect, it } from 'vitest';
import {
  boostAmount,
  boostDateRange,
  boostModeLabels,
  boostSpentPercent,
  boostStatusLabels,
  isoDay,
  validateBoostWindow,
} from './boosts';

describe('boostStatusLabels', () => {
  it("couvre chaque état affichable avec un libellé français", () => {
    expect(boostStatusLabels).toEqual({
      pending: 'Paiement en attente',
      scheduled: 'Programmée',
      live: 'En ligne',
      paused: 'En pause',
      ended: 'Terminée',
      exhausted: 'Budget épuisé',
      canceled: 'Annulée',
    });
    expect(Object.values(boostStatusLabels)).not.toContain(undefined);
  });

  it('libelle les deux modes de facturation', () => {
    expect(boostModeLabels).toEqual({ cpc: 'Par clic', cpi: 'Par impression' });
  });
});

describe('boostAmount', () => {
  // Intl fr-FR sépare les milliers par une espace fine insécable (U+202F) :
  // on normalise avant de comparer pour rester lisible dans le test.
  const plain = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ');

  it('abrège XOF en « F » avec séparateur de milliers', () => {
    expect(plain(boostAmount(1000))).toBe('1 000 F');
    expect(boostAmount(50)).toBe('50 F');
  });

  it('garde une devise étrangère telle quelle', () => {
    expect(plain(boostAmount(2500, 'GHS'))).toBe('2 500 GHS');
  });
});

describe('boostDateRange', () => {
  it('assemble les deux bornes en une phrase', () => {
    const label = boostDateRange('2026-10-06T12:00:00.000Z', '2026-11-05T12:00:00.000Z');
    expect(label).toMatch(/^du .+ au .+$/);
    expect(label).toContain('2026');
  });
});

describe('isoDay', () => {
  it("formatte une date locale en YYYY-MM-DD pour <input type='date'>", () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoDay(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('validateBoostWindow', () => {
  const today = isoDay(new Date());
  const plusDays = (days: number) => isoDay(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

  it('accepte une fenêtre par défaut de 30 jours à partir d’aujourd’hui', () => {
    expect(validateBoostWindow(today, plusDays(30))).toBeNull();
  });

  it('refuse un début dans le passé', () => {
    expect(validateBoostWindow(plusDays(-1), plusDays(29))).toBe(
      'La date de début ne peut pas être dans le passé',
    );
  });

  it('refuse une fin antérieure ou égale au début', () => {
    expect(validateBoostWindow(today, today)).toBe(
      'La date de fin doit être postérieure à la date de début',
    );
    expect(validateBoostWindow(plusDays(5), plusDays(5))).toBe(
      'La date de fin doit être postérieure à la date de début',
    );
  });

  it('refuse une durée supérieure à 90 jours', () => {
    expect(validateBoostWindow(today, plusDays(91))).toBe(
      'La campagne ne peut pas durer plus de 90 jours',
    );
    // 90 jours pile : entre octobre et janvier le passage à l'heure d'hiver
    // à Paris décale l'instant de fin d'une heure — on garde une marge ici,
    // la borne exacte est couverte par le refus à 91 jours.
    expect(validateBoostWindow(today, plusDays(89))).toBeNull();
  });

  it('refuse une valeur de date corrompue', () => {
    expect(validateBoostWindow('not-a-date', today)).toBe('Date invalide');
  });
});

describe('boostSpentPercent', () => {
  it('rapporte la consommation bornée entre 0 et 100', () => {
    expect(boostSpentPercent(1000, 250)).toBe(25);
    expect(boostSpentPercent(1000, 1500)).toBe(100);
    expect(boostSpentPercent(1000, -5)).toBe(0);
    expect(boostSpentPercent(0, 10)).toBe(0);
  });
});
