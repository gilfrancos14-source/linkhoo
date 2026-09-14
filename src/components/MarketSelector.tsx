import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket, type MarketCode } from '../contexts/MarketContext';
import type { ReactNode } from 'react';

type MarketOption = { code: MarketCode; label: string; flag: ReactNode };

function FlagCI() {
  return (
    <svg viewBox="0 0 30 20" width="24" height="16" aria-hidden="true">
      <rect width="10" height="20" fill="#F77F00" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#009E60" />
    </svg>
  );
}

function FlagBJ() {
  return (
    <svg viewBox="0 0 30 20" width="24" height="16" aria-hidden="true">
      <rect width="12" height="20" fill="#008751" />
      <rect x="12" width="18" height="10" fill="#FCD116" />
      <rect x="12" y="10" width="18" height="10" fill="#E8112D" />
    </svg>
  );
}

const MARKETS: MarketOption[] = [
  { code: 'CI', label: 'Côte d\'Ivoire', flag: <FlagCI /> },
  { code: 'BJ', label: 'Bénin', flag: <FlagBJ /> },
];

export default function MarketSelector() {
  const { market, setMarket } = useMarket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = MARKETS.find((m) => m.code === market) ?? MARKETS[0];

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
    if (code === market) {
      setOpen(false);
      return;
    }
    setMarket(code);
    setOpen(false);
    navigate(`/${code.toLowerCase()}`, { replace: true });
  };

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
        <span className="market-selector__flag">{selected.flag}</span>
        <span className="header-btn__label">{selected.code}</span>
      </button>

      {open && (
        <ul className="market-selector__dropdown" role="listbox" aria-label="Choisir le marché">
          {MARKETS.map((m) => (
            <li key={m.code} role="option" aria-selected={m.code === selected.code}>
              <button
                type="button"
                className={`market-selector__option${m.code === selected.code ? ' is-active' : ''}`}
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
