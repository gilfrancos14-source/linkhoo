import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketCode } from '../config/markets';
import MaquetteBannerCarousel from './MaquetteBannerCarousel';
import type { BannerSlide, CityEventCard, FeaturedEvent } from './viewModel';

interface EventsSectionProps {
  market: MarketCode;
  cities: CityEventCard[];
  featuredEvents: FeaturedEvent[];
  banners: BannerSlide[];
}

const CITY_BADGES = [
  { className: 'bg-[#FF5E1E]', icon: 'fa-location-dot' },
  { className: 'bg-amber-500', icon: 'fa-masks-theater' },
  { className: 'bg-orange-600', icon: 'fa-landmark' },
  { className: 'bg-[#FF5E1E]', icon: 'fa-water' },
] as const;

export default function EventsSection({ market, cities, featuredEvents, banners }: EventsSectionProps) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (cities.length === 0 && featuredEvents.length === 0 && banners.length === 0) return null;

  const safeIndex = Math.min(index, Math.max(0, featuredEvents.length - 1));
  const featured = featuredEvents[safeIndex] ?? null;
  const hasFeatured = Boolean(featured && !dismissed);
  const search = (query: string) =>
    `/${market.toLowerCase()}/recherche?q=${encodeURIComponent(query)}`;

  const cityGrid = !hasFeatured
    ? 'grid-cols-2 sm:grid-cols-4'
    : cities.length >= 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : cities.length === 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : cities.length === 2
          ? 'grid-cols-2'
          : 'grid-cols-1';

  const citiesSpan = !hasFeatured
    ? 'lg:col-span-12'
    : cities.length >= 4
      ? 'lg:col-span-7'
      : cities.length === 3
        ? 'lg:col-span-6'
        : cities.length === 2
          ? 'lg:col-span-5'
          : 'lg:col-span-3';

  const featuredSpan =
    cities.length === 0
      ? 'lg:col-span-12'
      : cities.length === 1
        ? 'lg:col-span-9'
        : cities.length === 2
          ? 'lg:col-span-7'
          : cities.length === 3
            ? 'lg:col-span-6'
            : 'lg:col-span-5';

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="events-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">
              <i className="fa-regular fa-calendar"></i>
            </span>
            Événements
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ne manquez pas les événements incontournables de votre région.
          </p>
        </div>
        <MaquetteBannerCarousel banners={banners} />
      </div>
      {(cities.length > 0 || featuredEvents.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className={`${citiesSpan} grid ${cityGrid} gap-3`}>
          {cities.map((city, cityIndex) => {
            const badge = CITY_BADGES[cityIndex % CITY_BADGES.length];
            return (
              <div
                key={city.city}
                className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm"
              >
                <div className="relative h-36 rounded-xl overflow-hidden mb-2 bg-slate-100 flex items-center justify-center">
                  {city.image ? (
                    <img
                      alt={city.alt}
                      className="w-full h-full object-cover"
                      src={city.image}
                      loading="lazy"
                    />
                  ) : (
                    <i className="fa-solid fa-city text-2xl text-slate-300"></i>
                  )}
                  <span
                    className={`absolute bottom-1.5 left-1.5 w-6 h-6 rounded-full ${badge.className} text-white text-[10px] flex items-center justify-center`}
                  >
                    <i className={`fa-solid ${badge.icon}`}></i>
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900">{city.city}</p>
                <p className="text-[10px] text-slate-400">
                  {city.count} événement{city.count > 1 ? 's' : ''}
                </p>
              </div>
            );
          })}
        </div>
        {featured && !dismissed && (
          <div
            className={`${featuredSpan} bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center`}
          >
            <div className="w-full sm:w-48 h-36 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
              {featured.image ? (
                <img
                  alt={featured.alt}
                  className="w-full h-full object-cover"
                  src={featured.image}
                  loading="lazy"
                />
              ) : (
                <i className="fa-regular fa-calendar text-2xl text-slate-300"></i>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-between h-full w-full py-1">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-bold text-slate-900 text-sm">
                    {featured.title} – {featured.city}
                  </span>
                  <button
                    type="button"
                    aria-label="Fermer l'événement"
                    className="text-slate-400 hover:text-slate-600"
                    onClick={() => setDismissed(true)}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#FF5E1E] font-semibold mb-1">
                  <i className="fa-regular fa-clock"></i>
                  <span>{featured.date}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{featured.description}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link
                  className="px-3 py-1.5 bg-[#0E1A2D] hover:bg-[#FF5E1E] !text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                  to={search(featured.city)}
                >
                  <span>Voir les biens pour cet événement</span>
                  <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </Link>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <button
                    type="button"
                    aria-label="Événement précédent"
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-50"
                    disabled={safeIndex <= 0}
                    onClick={() => setIndex(Math.max(0, safeIndex - 1))}
                  >
                    <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  </button>
                  <span>
                    {String(safeIndex + 1).padStart(2, '0')} /{' '}
                    {String(featuredEvents.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    aria-label="Événement suivant"
                    className="text-slate-600 hover:text-slate-900 disabled:opacity-50"
                    disabled={safeIndex >= featuredEvents.length - 1}
                    onClick={() =>
                      setIndex(Math.min(featuredEvents.length - 1, safeIndex + 1))
                    }
                  >
                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </section>
  );
}
