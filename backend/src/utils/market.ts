export type MarketCode = 'CI' | 'BJ';

export function isValidMarket(market: string): market is MarketCode {
  return market === 'CI' || market === 'BJ';
}
