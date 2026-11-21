import { describe, expect, it } from 'vitest';
import { phoneMatchesMarket } from './phoneMarket';

describe('phoneMatchesMarket', () => {
  it('accepte un numéro international du bon marché', () => {
    // CI : +225 + 10 chiffres (13 au total)
    expect(phoneMatchesMarket('+2250700000000', 'CI')).toBe(true);
    // BJ : +229 + 10 chiffres (13 au total)
    expect(phoneMatchesMarket('+2299600000000', 'BJ')).toBe(true);
  });

  it('accepte le format 00 + indicatif', () => {
    expect(phoneMatchesMarket('002250700000000', 'CI')).toBe(true);
  });

  it('accepte un numéro local sans indicatif', () => {
    expect(phoneMatchesMarket('0700000000', 'CI')).toBe(true);
  });

  it('refuse un numéro d’un AUTRE marché', () => {
    expect(phoneMatchesMarket('+2299600000000', 'CI')).toBe(false);
    expect(phoneMatchesMarket('+2250700000000', 'BJ')).toBe(false);
  });

  it('refuse un numéro fictif (longueur ou prefixe invalide)', () => {
    // +2250000000000 : meme longueur mais prefixe "0" puis tout zeros.
    expect(phoneMatchesMarket('+2250000000000', 'CI')).toBe(false);
    // Trop court.
    expect(phoneMatchesMarket('+2250700000', 'CI')).toBe(false);
  });

  it('refuse un numéro vide', () => {
    expect(phoneMatchesMarket('', 'CI')).toBe(false);
    expect(phoneMatchesMarket(null, 'CI')).toBe(false);
    expect(phoneMatchesMarket('123', 'CI')).toBe(false);
  });
});
