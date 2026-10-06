import { describe, expect, it } from 'vitest';
import { MARKETS, MARKET_CODES, isMarketCode, marketByCode, type MarketCode } from './markets';

describe('registre de marché (backend)', () => {
  it('contient exactement les 12 marchés, dans l’ordre figé', () => {
    expect([...MARKET_CODES]).toEqual([
      'CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD',
    ]);
    expect(MARKETS.map((m) => m.code)).toEqual([...MARKET_CODES]);
  });

  it('définit un slug, un label, un pays et une devise XOF pour chaque marché', () => {
    const slugs = new Set<string>();
    for (const market of MARKETS) {
      expect(market.slug).toMatch(/^[a-z]{2,12}$/);
      expect(slugs.has(market.slug)).toBe(false);
      slugs.add(market.slug);
      expect(market.label.length).toBeGreaterThan(0);
      expect(market.pays.length).toBeGreaterThan(0);
      expect(market.currency).toBe('XOF');
      expect(Math.abs(market.center.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(market.center.lng)).toBeLessThanOrEqual(180);
    }
    expect(slugs.size).toBe(MARKET_CODES.length);
  });

  it('garde CI et BJ en tête de liste (historique intact)', () => {
    expect(MARKET_CODES[0]).toBe('CI');
    expect(MARKET_CODES[1]).toBe('BJ');
    expect(MARKETS[0].slug).toBe('ci');
    expect(MARKETS[1].slug).toBe('bj');
  });

  it('isMarketCode filtre les codes inconnus', () => {
    expect(isMarketCode('SN')).toBe(true);
    expect(isMarketCode('XX')).toBe(false);
    expect(isMarketCode('sn')).toBe(false);
    expect(isMarketCode(undefined)).toBe(false);
    expect(isMarketCode(42)).toBe(false);
  });

  it('marketByCode retrouve chaque définition et lève sur un code inconnu', () => {
    for (const code of MARKET_CODES) {
      expect(marketByCode(code).code).toBe(code);
    }
    expect(() => marketByCode('XX' as MarketCode)).toThrow('Marché inconnu : XX');
  });
});
