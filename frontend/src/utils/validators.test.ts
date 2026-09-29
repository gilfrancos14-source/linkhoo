import { describe, expect, it } from 'vitest';
import { isValidEmail } from './validators';

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
