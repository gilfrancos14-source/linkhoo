import { describe, expect, it } from 'vitest';
import { premiumInitiateSchema, premiumConfirmSchema } from './premium';

describe('premiumInitiateSchema', () => {
  it('accepte les deux marchés', () => {
    expect(premiumInitiateSchema.safeParse({ market: 'CI' }).success).toBe(true);
    expect(premiumInitiateSchema.safeParse({ market: 'BJ' }).success).toBe(true);
  });

  it('refuse un marché inconnu', () => {
    const parsed = premiumInitiateSchema.safeParse({ market: 'XX' });
    expect(parsed.success).toBe(false);
  });

  it('exige le marché', () => {
    const parsed = premiumInitiateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = premiumInitiateSchema.safeParse({ market: 'CI', amount: 1000 });
    expect(parsed.success).toBe(false);
  });
});

describe('premiumConfirmSchema', () => {
  it('accepte une référence de paiement valide', () => {
    const parsed = premiumConfirmSchema.safeParse({ reference: 'PAY-2026-ABC123' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.reference).toBe('PAY-2026-ABC123');
  });

  it('refuse une référence absente ou mal formée', () => {
    expect(premiumConfirmSchema.safeParse({}).success).toBe(false);
    expect(premiumConfirmSchema.safeParse({ reference: 'abc' }).success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = premiumConfirmSchema.safeParse({
      reference: 'PAY-2026-ABC123',
      status: 'approved',
    });
    expect(parsed.success).toBe(false);
  });
});
