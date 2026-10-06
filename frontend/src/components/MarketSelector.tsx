import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isRootPath, useMarket, type MarketCode } from '../contexts/MarketContext';
import { MARKETS as MARKET_REGISTRY } from '../config/markets';
import {
  FlagBF,
  FlagBJ,
  FlagCD,
  FlagCG,
  FlagCI,
  FlagCM,
  FlagGA,
  FlagGN,
  FlagML,
  FlagNE,
  FlagSN,
  FlagTG,
} from './flags';

type MarketOption = { code: MarketCode; label: string; flag: ReactNode };

const FLAG_BY_CODE: Record<MarketCode, (props: { width?: number }) => ReactNode> = {
  CI: FlagCI,
  BJ: FlagBJ,
  SN: FlagSN,
  TG: FlagTG,
  CM: FlagCM,
  BF: FlagBF,
  CG: FlagCG,
  GA: FlagGA,
  GN: FlagGN,
  ML: FlagML,
  NE: FlagNE,
  CD: FlagCD,
};

// Options du sélecteur, dérivées du registre (config/markets.ts) : ajouter
// un marché là-bas suffit à l'afficher ici.
const MARKETS: MarketOption[] = MARKET_REGISTRY.map((m) => {
  const Flag = FLAG_BY_CODE[m.code];
  return { code: m.code, label: m.label, flag: <Flag width={24} /> };
});

// État par défaut à l'accueil : aucun marché encore choisi.
function FlagNone() {
  return (
    <svg
      viewBox="0 0 30 20"
      width={24}
      height={16}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="1" y="1" width="28" height="18" rx="3" strokeDasharray="3 2.5" />
      <circle cx="15" cy="10" r="5.2" />
      <path d="M15 4.8v10.4M9.9 10h10.2" />
    </svg>
  );
}

export default function MarketSelector() {
  const { market, setMarket } = useMarket();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = MARKETS.find((m) => m.code === market) ?? MARKETS[0];

  // Pages racine (accueil, /a-propos, /contact) : on peut changer de marché.
  // Sur les pages de marché (/ci, /bj, …) on affiche uniquement le drapeau,
  // non cliquable.
  const isLanding = isRootPath(pathname);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const switchMarket = (code: MarketCode) => {
    // setMarket navigue : le contexte dérive du marché de l'URL.
    // À l'accueil aucun marché n'est encore choisi (même CI) : on navigue
    // toujours, le choix n'est jamais déjà « actif ».
    setMarket(code);
    setOpen(false);
  };

  if (!isLanding) {
    return (
      <div className="market-selector market-selector--static">
        <span
          className="header-btn header-btn--market"
          role="img"
          aria-label={`Marché ${selected.label}`}
        >
          <span className="market-selector__flag">{selected.flag}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="market-selector" ref={ref}>
      <button
        type="button"
        className="header-btn header-btn--market"
        aria-label="Choisir le marché"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
      >
        <span className="market-selector__flag market-selector__flag--none">
          <FlagNone />
        </span>
        <span className="header-btn__label">Marché</span>
      </button>

      {open && (
        <ul className="market-selector__dropdown" role="listbox" aria-label="Choisir le marché">
          {MARKETS.map((m) => (
            <li key={m.code} role="option" aria-selected={false}>
              <button
                type="button"
                className="market-selector__option"
                onClick={() => switchMarket(m.code)}
              >
                <span className="market-selector__flag">{m.flag}</span>
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
