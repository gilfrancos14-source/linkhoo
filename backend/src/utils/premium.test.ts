import { describe, expect, it } from 'vitest';
import { isPremiumActive, isPremiumExpired } from './premium';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const FUTURE = '2026-12-01T00:00:00.000Z';
const PAST = '2026-01-01T00:00:00.000Z';

describe('isPremiumActive', () => {
  it('inactif sans gérant', () => {
    expect(isPremiumActive(null, NOW)).toBe(false);
    expect(isPremiumActive(undefined, NOW)).toBe(false);
  });

  it('inactif si le drapeau est faux ou absent', () => {
    expect(isPremiumActive({ is_premium: false, premium_expires_at: FUTURE }, NOW)).toBe(false);
    expect(isPremiumActive({ premium_expires_at: FUTURE }, NOW)).toBe(false);
  });

  it('actif avec une date future', () => {
    expect(isPremiumActive({ is_premium: true, premium_expires_at: FUTURE }, NOW)).toBe(true);
  });

  it('inactif avec une date passée (badge premium expiré)', () => {
    expect(isPremiumActive({ is_premium: true, premium_expires_at: PAST }, NOW)).toBe(false);
  });

  it('actif sans date d’expiration quand le drapeau est vrai', () => {
    expect(isPremiumActive({ is_premium: true, premium_expires_at: null }, NOW)).toBe(true);
    expect(isPremiumActive({ is_premium: true }, NOW)).toBe(true);
  });

  it('inactif si la date est illisible', () => {
    expect(isPremiumActive({ is_premium: true, premium_expires_at: 'pas-une-date' }, NOW)).toBe(false);
    expect(isPremiumActive({ is_premium: true, premium_expires_at: '' }, NOW)).toBe(false);
  });
});

describe('isPremiumExpired', () => {
  it('détecte une date dépassée sur un drapeau actif', () => {
    expect(isPremiumExpired({ is_premium: true, premium_expires_at: PAST }, NOW)).toBe(true);
  });

  it('ne signale ni le premium actif ni le drapeau baissé', () => {
    expect(isPremiumExpired({ is_premium: true, premium_expires_at: FUTURE }, NOW)).toBe(false);
    expect(isPremiumExpired({ is_premium: false, premium_expires_at: PAST }, NOW)).toBe(false);
    expect(isPremiumExpired({ is_premium: true, premium_expires_at: null }, NOW)).toBe(false);
    expect(isPremiumExpired({ is_premium: true, premium_expires_at: 'corrompue' }, NOW)).toBe(false);
  });
});
