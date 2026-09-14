import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type MarketCode = 'CI' | 'BJ';

interface MarketContextValue {
  market: MarketCode;
  setMarket: (m: MarketCode) => void;
}

const MarketContext = createContext<MarketContextValue | null>(null);

const STORAGE_KEY = 'ilehya-market';

function getInitialMarket(): MarketCode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'CI' || stored === 'BJ') return stored;
  return 'CI';
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarketState] = useState<MarketCode>(getInitialMarket);

  useEffect(() => {
    document.documentElement.setAttribute('data-market', market);
  }, [market]);

  const setMarket = (m: MarketCode) => {
    setMarketState(m);
    localStorage.setItem(STORAGE_KEY, m);
  };

  return (
    <MarketContext.Provider value={{ market, setMarket }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}
