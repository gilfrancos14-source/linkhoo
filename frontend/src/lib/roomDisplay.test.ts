import { describe, expect, it } from 'vitest';
import {
  formatCapacity,
  formatPrice,
  priceWithCurrency,
  roomMeta,
  roomSubtitle,
} from './roomDisplay';

describe('formatPrice', () => {
  it('groupe les milliers avec une espace ASCII', () => {
    expect(formatPrice('75000')).toBe('75 000');
    expect(formatPrice(250000)).toBe('250 000');
    expect(formatPrice('9000')).toBe('9 000');
  });

  it('est idempotent sur les prix déjà groupés', () => {
    expect(formatPrice('15 000')).toBe('15 000');
    expect(formatPrice('75 000')).toBe('75 000');
    expect(formatPrice('75\u00A0000')).toBe('75 000');
  });

  it('ne touche pas aux prix courts ni aux valeurs non numériques', () => {
    expect(formatPrice('660')).toBe('660');
    expect(formatPrice('50 000 FCFA')).toBe('50 000 FCFA');
    expect(formatPrice('sur demande')).toBe('sur demande');
    expect(formatPrice('')).toBe('');
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(undefined)).toBe('');
  });
});

describe('priceWithCurrency', () => {
  it('ajoute FCFA quand la devise est absente', () => {
    expect(priceWithCurrency('75000', '/ mois')).toBe('75 000 FCFA');
    expect(priceWithCurrency(119, '/ nuit')).toBe('119 FCFA');
  });

  it('ne double jamais la devise déjà présente', () => {
    expect(priceWithCurrency('15 000', 'FCFA / nuit')).toBe('15 000');
    expect(priceWithCurrency('50 000 FCFA', '/ mois')).toBe('50 000 FCFA');
  });

  it('renvoie une chaîne vide sans prix', () => {
    expect(priceWithCurrency('', '/ mois')).toBe('');
    expect(priceWithCurrency(null, '/ mois')).toBe('');
  });
});

describe('formatCapacity', () => {
  it('accorde le pluriel', () => {
    expect(formatCapacity(1)).toBe('1 personne');
    expect(formatCapacity(4)).toBe('4 personnes');
  });

  it('replie sur une personne si la valeur est invalide', () => {
    expect(formatCapacity(0)).toBe('1 personne');
    expect(formatCapacity(Number.NaN)).toBe('1 personne');
  });
});

describe('roomSubtitle', () => {
  it('utilise le sous-titre existant', () => {
    expect(
      roomSubtitle({
        subtitle: 'Appartement spacieux idéal pour les familles',
        description: 'Autre chose.',
        quartier: 'Cocody',
        ville: 'Abidjan',
      }),
    ).toBe('Appartement spacieux idéal pour les familles');
  });

  it("retombe sur la première phrase de la description", () => {
    expect(
      roomSubtitle({
        subtitle: '',
        description: 'Vue sur mer, calme absolu. Proche des commerces.',
      }),
    ).toBe('Vue sur mer, calme absolu.');
  });

  it('tronque une description sans ponctuation', () => {
    const subtitle = roomSubtitle({ subtitle: '', description: 'a'.repeat(200) });
    expect(subtitle).toHaveLength(120);
    expect(subtitle.endsWith('…')).toBe(true);
  });

  it("retombe sur le lieu quand il n'y a ni sous-titre ni description", () => {
    expect(
      roomSubtitle({ subtitle: '  ', description: null, quartier: 'Haie Vive', ville: 'Cotonou' }),
    ).toBe('Haie Vive, Cotonou');
    expect(roomSubtitle({ subtitle: '', description: '', quartier: '', ville: 'Cotonou' })).toBe(
      'Cotonou',
    );
  });

  it('renvoie une chaîne vide plutôt que du texte vide', () => {
    expect(roomSubtitle({ subtitle: '   ', description: ' ' })).toBe('');
  });
});

describe('roomMeta', () => {
  it('affiche le nombre de chambres avec le bon pluriel', () => {
    expect(roomMeta({ chambres: 2 })).toEqual(['2 chambres']);
    expect(roomMeta({ chambres: 1 })).toEqual(['1 chambre']);
  });

  it('retire les valeurs manquantes plutôt que de laisser une puce vide', () => {
    expect(roomMeta({ chambres: 0 })).toEqual([]);
    expect(roomMeta({})).toEqual([]);
    expect(roomMeta({ chambres: null })).toEqual([]);
  });
});
