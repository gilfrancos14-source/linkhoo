import { useMarket } from '../contexts/MarketContext';

export function useHomePath(): string {
  const { market } = useMarket();
  return `/${market.toLowerCase()}`;
}
