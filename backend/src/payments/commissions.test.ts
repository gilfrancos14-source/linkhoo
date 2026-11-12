import { describe, expect, it } from 'vitest';
import {
  COMMISSION_PERCENT_BY_TIER,
  commissionPercentFor,
  commissionTierFor,
} from './commissions';

/**
 * Grille de commission décidée le 12/11/2026 :
 * premium ET vérifié → 5 %, vérifié seul → 10 %, sans statut → 15 %.
 */

describe('grille de commission', () => {
  it('prélève 5 % pour un gérant premium et vérifié', () => {
    const gerant = {
      is_verified: true,
      is_premium: true,
      premium_expires_at: '2027-01-01T00:00:00.000Z',
    };
    expect(commissionTierFor(gerant)).toBe('premium_verified');
    expect(commissionPercentFor(gerant)).toBe(5);
  });

  it('prélève 10 % pour un gérant vérifié seulement', () => {
    const gerant = { is_verified: true, is_premium: false, premium_expires_at: null };
    expect(commissionTierFor(gerant)).toBe('verified');
    expect(commissionPercentFor(gerant)).toBe(10);
  });

  it('prélève 15 % pour un gérant sans premium ni vérification', () => {
    const gerant = { is_verified: false, is_premium: false, premium_expires_at: null };
    expect(commissionTierFor(gerant)).toBe('none');
    expect(commissionPercentFor(gerant)).toBe(15);
  });

  it('prélève 15 % quand le premium a expiré', () => {
    const gerant = {
      is_verified: false,
      is_premium: true,
      premium_expires_at: '2020-01-01T00:00:00.000Z',
    };
    expect(commissionTierFor(gerant, new Date('2026-11-12T00:00:00.000Z'))).toBe('none');
  });

  it('classe un premium seul avec les gérants ayant un seul statut', () => {
    const gerant = {
      is_verified: false,
      is_premium: true,
      premium_expires_at: '2027-01-01T00:00:00.000Z',
    };
    expect(commissionTierFor(gerant)).toBe('premium');
    expect(commissionPercentFor(gerant)).toBe(10);
  });

  it('traite un premium sans date d’expiration comme actif', () => {
    const gerant = { is_verified: true, is_premium: true, premium_expires_at: null };
    expect(commissionTierFor(gerant)).toBe('premium_verified');
  });

  it('tolère un gérant absent', () => {
    expect(commissionTierFor(null)).toBe('none');
    expect(commissionPercentFor(undefined)).toBe(15);
  });

  it('expose des pourcentages entiers et croissants avec le statut', () => {
    expect(COMMISSION_PERCENT_BY_TIER.premium_verified).toBeLessThan(
      COMMISSION_PERCENT_BY_TIER.verified,
    );
    expect(COMMISSION_PERCENT_BY_TIER.verified).toBeLessThan(COMMISSION_PERCENT_BY_TIER.none);
  });
});
