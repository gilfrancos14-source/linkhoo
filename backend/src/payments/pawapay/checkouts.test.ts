import { describe, expect, it, vi } from 'vitest';

// `checkouts.ts` importe supabaseAdmin (qui exige des variables d'env) :
// on le neutralise pour tester uniquement les helpers purs.
vi.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));

import { buildMetadata, normalizePawapayReason, type PawapayCheckoutInput } from './checkouts';
import { validateAmountForMarket } from './markets';

function input(overrides: Partial<PawapayCheckoutInput> = {}): PawapayCheckoutInput {
  return {
    paymentId: 'payment-1',
    reference: 'PAY-2026-ABCDEF',
    market: 'CI',
    amountXof: 5_000,
    description: 'Réservation appartement',
    returnPath: '/ci/reservation/paiement',
    failurePath: '/ci/reservation/paiement',
    ...overrides,
  };
}

describe('normalizePawapayReason', () => {
  it('produit un texte ASCII de 4 à 22 caractères', () => {
    const reason = normalizePawapayReason('Réservation appartement à Abidjan');
    expect(reason.length).toBeGreaterThanOrEqual(4);
    expect(reason.length).toBeLessThanOrEqual(22);
    expect(reason).toMatch(/^[a-zA-Z0-9 ]+$/);
  });

  it('retombe sur un libellé par défaut si le texte est trop court', () => {
    expect(normalizePawapayReason('ab')).toBe('Paiement Ileyha');
  });
});

describe('buildMetadata', () => {
  it('envoie un tableau d’objets à clé libre, borné à 10 champs', () => {
    const metadata = buildMetadata(
      input({
        metadata: Object.fromEntries(
          Array.from({ length: 15 }, (_, index) => [`cle${index}`, `valeur${index}`]),
        ),
      }),
    );

    expect(metadata.length).toBeLessThanOrEqual(10);
    expect(metadata[0]).toHaveProperty('paymentId', 'payment-1');
    for (const field of metadata) {
      expect(Object.keys(field)).toHaveLength(1);
    }
  });
});

describe('validateAmountForMarket', () => {
  it('accepte un montant dans les bornes', () => {
    expect(() => validateAmountForMarket('CI', 500)).not.toThrow();
    expect(() => validateAmountForMarket('CI', 10_000_000)).not.toThrow();
  });

  it('rejette un montant sous le minimum', () => {
    expect(() => validateAmountForMarket('CI', 499)).toThrowError(/minimum/);
  });

  it('rejette un montant au-dessus du maximum', () => {
    expect(() => validateAmountForMarket('CI', 10_000_001)).toThrowError(/maximum/);
  });
});
