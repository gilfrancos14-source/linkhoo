import { describe, expect, it } from 'vitest';
import {
  mapCountryToISO3,
  mapFromISO3,
  mapPawapayStatus,
  mapToPawapayStatus,
} from './mapping';

describe('mapping pawaPay', () => {
  it('convertit les codes pays 2 lettres en ISO3 et laisse passer l’ISO3', () => {
    expect(mapCountryToISO3('CI')).toBe('CIV');
    expect(mapCountryToISO3('SN')).toBe('SEN');
    expect(mapCountryToISO3('CIV')).toBe('CIV');
    expect(mapFromISO3('BEN')).toBe('BJ');
  });

  it('mappe les statuts pawaPay vers les statuts internes', () => {
    expect(mapPawapayStatus('COMPLETED')).toBe('succeeded');
    expect(mapPawapayStatus('SUCCEEDED')).toBe('succeeded');
    expect(mapPawapayStatus('WAITING_PAYMENT')).toBe('pending');
    expect(mapPawapayStatus('PROCESSING')).toBe('pending');
    expect(mapPawapayStatus('ACCEPTED')).toBe('pending');
    expect(mapPawapayStatus('CANCELLED')).toBe('canceled');
    expect(mapPawapayStatus('REJECTED')).toBe('failed');
  });

  it('mappe les statuts internes vers pawaPay', () => {
    expect(mapToPawapayStatus('succeeded')).toBe('COMPLETED');
    expect(mapToPawapayStatus('canceled')).toBe('CANCELLED');
    expect(mapToPawapayStatus('pending')).toBe('WAITING_PAYMENT');
  });
});
