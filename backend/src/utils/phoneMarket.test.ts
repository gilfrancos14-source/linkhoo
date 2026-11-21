import { describe, expect, it } from 'vitest';
import { phoneMatchesMarket } from './phoneMarket';

describe('phoneMatchesMarket', () => {
  it('accepte un numéro international du bon marché', () => {
    expect(phoneMatchesMarket('+2250700000000', 'CI')).toBe(true);
    expect(phoneMatchesMarket('229 96 00 00 00', 'BJ')).toBe(true);
  });

  it('accepte le format 00 + indicatif', () => {
    expect(phoneMatchesMarket('00225070000000', 'CI')).toBe(true);
  });

  it('accepte un numéro local sans indicatif', () => {
    expect(phoneMatchesMarket('0700000000', 'CI')).toBe(true);
  });

  it('refuse un numéro d’un AUTRE marché', () => {
    expect(phoneMatchesMarket('+22996000000', 'CI')).toBe(false);
    expect(phoneMatchesMarket('+22507000000', 'BJ')).toBe(false);
  });

  it('refuse un numéro vide ou trop court', () => {
    expect(phoneMatchesMarket('', 'CI')).toBe(false);
    expect(phoneMatchesMarket(null, 'CI')).toBe(false);
    expect(phoneMatchesMarket('123', 'CI')).toBe(false);
  });
});
