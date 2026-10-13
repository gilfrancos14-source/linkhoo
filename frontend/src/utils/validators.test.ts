import { describe, expect, it } from 'vitest';
import { containsPhoneNumber, isValidEmail } from './validators';

describe('isValidEmail', () => {
  it('accepte les adresses valides', () => {
    expect(isValidEmail('aya@mail.ci')).toBe(true);
    expect(isValidEmail('a.b+tag@sub.domain.co')).toBe(true);
    expect(isValidEmail('x@y.io')).toBe(true);
    expect(isValidEmail('prenom.nom@ilehya-location.ci')).toBe(true);
  });

  it('rejette les adresses sans @', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('plainaddress')).toBe(false);
    expect(isValidEmail('aya.mail.ci')).toBe(false);
  });

  it('rejette les adresses sans domaine local', () => {
    expect(isValidEmail('@mail.ci')).toBe(false);
    expect(isValidEmail('aya@')).toBe(false);
  });

  it('rejette les adresses sans domaine de premier niveau', () => {
    expect(isValidEmail('aya@mail')).toBe(false);
    expect(isValidEmail('aya@mail.')).toBe(false);
  });

  it('rejette les espaces', () => {
    expect(isValidEmail('aya @mail.ci')).toBe(false);
    expect(isValidEmail('aya@ mail.ci')).toBe(false);
    expect(isValidEmail(' aya@mail.ci')).toBe(false);
    expect(isValidEmail('aya@mail.ci ')).toBe(false);
  });

  it('rejette les adresses avec plusieurs @', () => {
    expect(isValidEmail('aya@@mail.ci')).toBe(false);
    expect(isValidEmail('aya@mail@ci')).toBe(false);
  });
});

describe('containsPhoneNumber', () => {
  it('détecte un numéro local, international ou collé', () => {
    expect(containsPhoneNumber('Appelez le 07 07 07 07 07')).toBe(true);
    expect(containsPhoneNumber('Écrire à +225 07 07 07 07 07')).toBe(true);
    expect(containsPhoneNumber('Tapez 0707070707')).toBe(true);
  });

  it('détecte les mots-clés de contournement', () => {
    expect(containsPhoneNumber('Contact par WhatsApp uniquement')).toBe(true);
    expect(containsPhoneNumber('Appelez-nous pour visiter')).toBe(true);
    expect(containsPhoneNumber('Téléphone : sur demande')).toBe(true);
  });

  it('accepte les descriptions sans coordonnée', () => {
    expect(containsPhoneNumber('Un studio confortable au cœur de Cocody.')).toBe(false);
    expect(containsPhoneNumber('Loyer 150 000 FCFA, caution 1 mois.')).toBe(false);
    expect(containsPhoneNumber('Disponible à partir du 12-03-2026.')).toBe(false);
    expect(containsPhoneNumber('Rénové en 2024, 32 m².')).toBe(false);
  });
});
