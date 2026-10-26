import { Link } from 'react-router-dom';
import type { MarketCode } from '../config/markets';
import type { EscapadeCard } from './viewModel';

interface EscapadesSectionProps {
  market: MarketCode;
  cards: EscapadeCard[];
}

export default function EscapadesSection({ market, cards }: EscapadesSectionProps) {
  if (cards.length === 0) return null;

  const search = (query: string) =>
    `/${market.toLowerCase()}/recherche?q=${encodeURIComponent(query)}`;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="weekend-escapes">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">
              <i className="fa-solid fa-suitcase-rolling"></i>
            </span>
            Escapades weekend
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Des idées de séjours pour vous évader le temps d'un week-end.
          </p>
        </div>
      </div>
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Link
              key={card.id}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm group"
              to={search(card.lieu)}
            >
              <div className="relative h-28 overflow-hidden">
                <img
                  alt={`Week-end à ${card.lieu}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  src={card.cover}
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <h4 className="text-xs font-bold text-slate-900">Week-end à {card.lieu}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{card.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
