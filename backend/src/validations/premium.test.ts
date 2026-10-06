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
  it('accepte un identifiant positif', () => {
    const parsed = premiumConfirmSchema.safeParse({ transaction_id: 42 });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.transaction_id).toBe(42);
  });

  it('coerce une chaîne numérique en nombre', () => {
    const parsed = premiumConfirmSchema.safeParse({ transaction_id: '99' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.transaction_id).toBe(99);
  });

  it('refuse un identifiant nul, négatif ou non entier', () => {
    expect(premiumConfirmSchema.safeParse({ transaction_id: 0 }).success).toBe(false);
    expect(premiumConfirmSchema.safeParse({ transaction_id: -5 }).success).toBe(false);
    expect(premiumConfirmSchema.safeParse({ transaction_id: 1.5 }).success).toBe(false);
  });

  it('refuse une valeur non convertible', () => {
    expect(premiumConfirmSchema.safeParse({ transaction_id: 'abc' }).success).toBe(false);
    expect(premiumConfirmSchema.safeParse({}).success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = premiumConfirmSchema.safeParse({ transaction_id: 1, status: 'approved' });
    expect(parsed.success).toBe(false);
  });
});
