import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_FREE_HOURS,
  CANCELLATION_TOO_LATE_MESSAGE,
  canCancelReservation,
  cancellationDeadline,
  cancellationDeadlineIso,
  splitCancellationFee,
} from './cancellation';

/**
 * Règle d'annulation : possible jusqu'à 24 h avant la date d'arrivée, bloquée
 * au-delà.
 */

const ARRIVAL = '2031-06-15';

describe('règle d’annulation', () => {
  it('calcule la limite à 24 h avant l’arrivée', () => {
    const deadline = cancellationDeadline(ARRIVAL);
    expect(deadline).not.toBeNull();
    // L’arrivée est stockée en date seule (minuit UTC) : la limite est donc
    // le 14 juin à 00:00 UTC.
    expect(deadline?.toISOString()).toBe('2031-06-14T00:00:00.000Z');
  });

  it('autorise l’annulation tant que la limite n’est pas passée', () => {
    expect(canCancelReservation(ARRIVAL, new Date('2031-06-13T23:00:00.000Z'))).toBe(true);
    expect(canCancelReservation(ARRIVAL, new Date('2031-06-14T00:00:00.000Z'))).toBe(true);
  });

  it('bloque l’annulation une fois la limite passée', () => {
    expect(canCancelReservation(ARRIVAL, new Date('2031-06-14T00:00:01.000Z'))).toBe(false);
    expect(canCancelReservation(ARRIVAL, new Date('2031-06-15T12:00:00.000Z'))).toBe(false);
  });

  it('ne bloque pas quand la date d’arrivée est illisible', () => {
    expect(canCancelReservation(null, new Date())).toBe(true);
    expect(canCancelReservation('', new Date())).toBe(true);
    expect(canCancelReservation('pas-une-date', new Date())).toBe(true);
    expect(cancellationDeadline('pas-une-date')).toBeNull();
  });

  it('expose la limite au format ISO pour l’API', () => {
    expect(cancellationDeadlineIso(ARRIVAL)).toBe('2031-06-14T00:00:00.000Z');
    expect(cancellationDeadlineIso(null)).toBeNull();
  });

  it('utilise un délai de 24 h', () => {
    expect(CANCELLATION_FREE_HOURS).toBe(24);
    expect(CANCELLATION_TOO_LATE_MESSAGE).toContain('24 h');
  });

  it('retient 3 % du montant lors d’une annulation, partagés moitié-moitié', () => {
    // 100 000 : le client reçoit 97 000, la retenue de 3 000 est partagée
    // 1 500 / 1 500 entre la plateforme et le gérant.
    expect(splitCancellationFee(100_000)).toEqual({
      fee: 3_000,
      platformFee: 1_500,
      gerantFee: 1_500,
      clientAmount: 97_000,
    });
    // Arrondi au franc près : l'arrondi va à la plateforme, le reste au gérant,
    // et platformFee + gerantFee === fee exactement.
    const small = splitCancellationFee(1_250); // fee = 38 (3,75 % arrondi)
    expect(small.fee).toBe(38);
    expect(small.platformFee + small.gerantFee).toBe(small.fee);
    expect(small.clientAmount).toBe(1_250 - small.fee);
    expect(splitCancellationFee(150_000)).toEqual({
      fee: 4_500,
      platformFee: 2_250,
      gerantFee: 2_250,
      clientAmount: 145_500,
    });
  });

  it('ne prélève rien sur un montant nul ou négatif', () => {
    expect(splitCancellationFee(0)).toEqual({ fee: 0, platformFee: 0, gerantFee: 0, clientAmount: 0 });
    expect(splitCancellationFee(-100)).toEqual({ fee: 0, platformFee: 0, gerantFee: 0, clientAmount: 0 });
  });

  it('partage toujours la retenue exactement, sans perte ni duplication', () => {
    for (const amount of [1, 2, 3, 7, 33, 99, 100, 999, 1_001, 50_000, 123_456]) {
      const r = splitCancellationFee(amount);
      expect(r.platformFee + r.gerantFee).toBe(r.fee);
      expect(r.fee + r.clientAmount).toBe(amount);
      expect(r.gerantFee).toBeGreaterThanOrEqual(0);
      expect(r.platformFee).toBeGreaterThanOrEqual(0);
    }
  });
});
