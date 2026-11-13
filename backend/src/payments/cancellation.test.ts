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

  it('retient 2 % du montant lors d’une annulation', () => {
    // 100 000 : le client reçoit 98 000, la plateforme garde 2 000.
    expect(splitCancellationFee(100_000)).toEqual({ fee: 2_000, clientAmount: 98_000 });
    // Arrondi au franc près.
    expect(splitCancellationFee(1_250)).toEqual({ fee: 25, clientAmount: 1_225 });
    expect(splitCancellationFee(150_000)).toEqual({ fee: 3_000, clientAmount: 147_000 });
  });

  it('ne prélève rien sur un montant nul ou négatif', () => {
    expect(splitCancellationFee(0)).toEqual({ fee: 0, clientAmount: 0 });
    expect(splitCancellationFee(-100)).toEqual({ fee: 0, clientAmount: 0 });
  });
});
