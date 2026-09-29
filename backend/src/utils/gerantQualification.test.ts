import { afterEach, describe, expect, it, vi } from 'vitest';
import { isQualifiedGerant } from './gerantQualification';

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

describe('isQualifiedGerant', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuse un gérant null', () => {
    expect(isQualifiedGerant(null)).toBe(false);
  });

  it('refuse un gérant undefined', () => {
    expect(isQualifiedGerant(undefined)).toBe(false);
  });

  it('refuse un gérant dont la vérification est nulle', () => {
    expect(isQualifiedGerant({ is_verified: null, is_premium: true, premium_expires_at: FUTURE })).toBe(false);
  });

  it('refuse un gérant non vérifié même premium', () => {
    expect(isQualifiedGerant({ is_verified: false, is_premium: true, premium_expires_at: FUTURE })).toBe(false);
  });

  it('refuse un gérant vérifié sans premium', () => {
    expect(isQualifiedGerant({ is_verified: true, is_premium: false, premium_expires_at: null })).toBe(false);
  });

  it('refuse un gérant dont is_premium est nul', () => {
    expect(isQualifiedGerant({ is_verified: true, is_premium: null })).toBe(false);
  });

  it('accepte un gérant vérifié et premium sans expiration', () => {
    expect(isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: null })).toBe(true);
  });

  it('accepte un gérant premium sans la clé premium_expires_at', () => {
    expect(isQualifiedGerant({ is_verified: true, is_premium: true })).toBe(true);
  });

  it('accepte une expiration future', () => {
    expect(isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: FUTURE })).toBe(true);
  });

  it('refuse une expiration passée', () => {
    expect(isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: PAST })).toBe(false);
  });

  it('refuse une expiration strictement égale à l’instant présent', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));

    expect(
      isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: '2026-06-15T12:00:00.000Z' }),
    ).toBe(false);
  });

  it('bascule de true à false quand la date d’expiration passe', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T11:59:59.000Z'));
    const gerant = { is_verified: true, is_premium: true, premium_expires_at: '2026-06-15T12:00:00.000Z' };

    expect(isQualifiedGerant(gerant)).toBe(true);

    vi.setSystemTime(new Date('2026-06-15T12:00:01.000Z'));
    expect(isQualifiedGerant(gerant)).toBe(false);
  });

  it('refuse un gérant dont la date d’expiration est illisible (accès refusé, pas maintenu)', () => {
    // Un premium_expires_at corrompu ne doit jamais laisser l'accès ouvert :
    // NaN <= now est faux, d'où un contrôle Number.isFinite explicite.
    expect(
      isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: 'pas-une-date' }),
    ).toBe(false);
    expect(
      isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: '' }),
    ).toBe(false);
    expect(
      isQualifiedGerant({ is_verified: true, is_premium: true, premium_expires_at: '2026-13-01' }),
    ).toBe(false);
  });
});
