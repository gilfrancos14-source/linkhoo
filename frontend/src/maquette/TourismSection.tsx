import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '../components/landing/data';
import type { MarketCode } from '../config/markets';
import type { TourismCard, TourismView } from './viewModel';

interface TourismSectionProps {
  market: MarketCode;
  view: TourismView | null;
}

export default function TourismSection({ market, view }: TourismSectionProps) {
  if (!view) return null;

  const country = COUNTRIES.find((item) => item.code === market) ?? COUNTRIES[0];
  const feminine = ['CI', 'GN', 'CD'].includes(market);
  const countryOf = feminine ? `de la ${country.label}` : `du ${country.label}`;
  const countryWithArticle = feminine ? `la ${country.label}` : `le ${country.label}`;
  const countryAt = feminine ? `en ${country.label}` : `au ${country.label}`;
  const countrySentence = `${feminine ? 'La' : 'Le'} ${country.label}`;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="tourism-section">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">
              <i className="fa-solid fa-compass"></i>
            </span>
            Tourisme
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Découvrez les trésors {countryOf} : nature, culture, histoire et bien plus encore.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-3xl overflow-hidden relative shadow-lg min-h-[300px] flex flex-col justify-end p-6 sm:p-8 text-white">
          {view.bannerImage && (
            <img
              alt={`Plage et aventure ${countryAt}`}
              className="absolute inset-0 w-full h-full object-cover"
              src={view.bannerImage}
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent"></div>
          <div className="relative z-10 max-w-xl">
            <span className="inline-block px-2.5 py-0.5 bg-[#FF5E1E] text-white text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">
              Expériences Uniques
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight">
              Explorez {countryWithArticle},
              <br />
              une terre de culture et d'aventure.
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 mt-2">
              Des plages paradisiaques, des sites historiques et une culture riche vous attendent
              pour un séjour inoubliable.
            </p>
            <p className="font-handwriting text-xl text-amber-300 mt-1">
              {countrySentence} vous inspire !
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-umbrella-beach text-[#FF5E1E] text-lg"></i>
                <span className="text-[10px] font-medium text-slate-200">
                  Plages paradisiaques et nature préservée
                </span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-monument text-[#FF5E1E] text-lg"></i>
                <span className="text-[10px] font-medium text-slate-200">
                  Culture et histoire exceptionnelles
                </span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-utensils text-[#FF5E1E] text-lg"></i>
                <span className="text-[10px] font-medium text-slate-200">
                  Gastronomie locale savoureuse
                </span>
              </div>
            </div>
          </div>
        </div>
        <TourismHighlights view={view} />
      </div>
    </section>
  );
}

function TourismHighlights({ view }: { view: TourismView }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [view]);

  const selectedCard = selectedId
    ? [...view.longCards, ...view.minis].find((card) => card.id === selectedId) ?? null
    : null;

  return (
    <div className="lg:col-span-5 flex flex-col justify-between gap-4">
      {selectedCard ? (
        <div
          className="flex flex-1 flex-col min-h-[176px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          role="region"
          aria-label="Destinations mises en avant"
        >
          <TourismFeaturedCard card={selectedCard} />
        </div>
      ) : (
        <TourismCarousel cards={view.longCards} />
      )}

      {view.minis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {view.minis.map((card) => {
            const selected = selectedId === card.id;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={selected}
                className={`bg-white rounded-xl p-2 border text-center transition ${
                  selected
                    ? 'border-[#FF5E1E] ring-1 ring-[#FF5E1E]'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
                onClick={() => setSelectedId((current) => (current === card.id ? null : card.id))}
              >
                {card.image && (
                  <img
                    alt={card.alt}
                    className="w-full h-14 object-cover rounded-lg mb-1"
                    src={card.image}
                    loading="lazy"
                  />
                )}
                <p className="text-[11px] font-bold text-slate-900">{card.title}</p>
                <p className="text-[9px] text-slate-400">
                  {card.count} bien{card.count > 1 ? 's' : ''}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TourismFeaturedCard({ card }: { card: TourismCard }) {
  return (
    <div className="w-full flex-1 p-3 flex items-center gap-4">
      {card.image && (
        <img
          alt={card.alt}
          className="w-32 h-24 sm:w-40 sm:h-28 rounded-xl object-cover"
          src={card.image}
          loading="lazy"
        />
      )}
      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-900">{card.title}</h4>
        <p className="text-xs text-slate-400">
          {card.count} bien{card.count > 1 ? 's' : ''}
        </p>
        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{card.text}</p>
      </div>
      <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
        <i className="fa-solid fa-arrow-right text-xs"></i>
      </span>
    </div>
  );
}

function TourismCarousel({ cards }: { cards: TourismCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [active, setActive] = useState(0);

  const total = cards.length;

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[index] as HTMLElement | undefined;
    if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  }, []);

  const stopAuto = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startAuto = useCallback(() => {
    stopAuto();
    if (total <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % total;
        scrollTo(next);
        return next;
      });
    }, 5000);
  }, [scrollTo, stopAuto, total]);

  useEffect(() => {
    setActive(0);
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [cards]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      Array.from(track.children).forEach((child, index) => {
        const element = child as HTMLElement;
        const nextDistance = Math.abs(element.offsetLeft - track.scrollLeft);
        if (nextDistance < distance) {
          distance = nextDistance;
          closest = index;
        }
      });
      setActive(closest);
    };

    track.addEventListener('scroll', update, { passive: true });
    return () => track.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)').matches;
    if (!desktop) return;
    startAuto();
    return stopAuto;
  }, [startAuto, stopAuto]);

  useEffect(() => () => stopAuto(), [stopAuto]);

  if (total === 0) return null;

  return (
    <div
      className="relative flex flex-1 flex-col min-h-[176px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
      role="region"
      aria-label="Destinations mises en avant"
      onMouseEnter={stopAuto}
      onMouseLeave={startAuto}
      onTouchStart={stopAuto}
      onTouchEnd={startAuto}
    >
      <div ref={trackRef} className="flex flex-1 overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {cards.map((card, index) => (
          <div
            key={card.id}
            className="w-full shrink-0 snap-start flex items-center"
            aria-hidden={index !== active}
          >
            <TourismFeaturedCard card={card} />
          </div>
        ))}
      </div>

      {total > 1 && (
        <div
          className="absolute bottom-2 right-3 flex items-center gap-1.5"
          role="tablist"
          aria-label="Diapositives"
        >
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={`w-1.5 h-1.5 rounded-full transition ${
                index === active ? 'bg-slate-800 scale-125' : 'bg-slate-300'
              }`}
              aria-label={`Destination ${index + 1}`}
              aria-selected={index === active}
              role="tab"
              onClick={() => {
                setActive(index);
                scrollTo(index);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
