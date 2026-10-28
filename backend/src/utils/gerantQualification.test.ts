import { describe, expect, it } from 'vitest';
import { isQualifiedGerant } from './gerantQualification';

describe('isQualifiedGerant', () => {
  it('refuse un gérant null', () => {
    expect(isQualifiedGerant(null)).toBe(false);
  });

  it('refuse un gérant undefined', () => {
    expect(isQualifiedGerant(undefined)).toBe(false);
  });

  it('refuse un gérant dont la vérification est nulle', () => {
    expect(isQualifiedGerant({ is_verified: null })).toBe(false);
  });

  it('refuse un gérant non vérifié, même premium', () => {
    expect(isQualifiedGerant({ is_verified: false })).toBe(false);
  });

  it('accepte un gérant vérifié', () => {
    expect(isQualifiedGerant({ is_verified: true })).toBe(true);
  });

  it('accepte un gérant vérifié sans premium : le premium ne conditionne plus l’accès', () => {
    const gerantSansPremium = {
      is_verified: true,
      is_premium: false,
      premium_expires_at: null,
    };
    expect(isQualifiedGerant(gerantSansPremium)).toBe(true);
  });

  it('accepte un gérant vérifié dont le premium est expiré', () => {
    const gerantPremiumExpire = {
      is_verified: true,
      is_premium: true,
      premium_expires_at: '2020-01-01T00:00:00.000Z',
    };
    expect(isQualifiedGerant(gerantPremiumExpire)).toBe(true);
  });
});
