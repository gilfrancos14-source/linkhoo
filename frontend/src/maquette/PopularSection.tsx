import { useNavigate } from 'react-router-dom';
import type { MarketCode } from '../config/markets';
import { useFavorites } from '../contexts/FavoritesContext';
import MaquetteBannerCarousel from './MaquetteBannerCarousel';
import type { BannerSlide, PopularCard } from './viewModel';

interface PopularSectionProps {
  market: MarketCode;
  cards: PopularCard[];
  banners: BannerSlide[];
}

export default function PopularSection({ market, cards, banners }: PopularSectionProps) {
  const navigate = useNavigate();
  const { isFavorite, toggle, signedIn } = useFavorites();

  const toggleFavorite = (id: string) => {
    if (!signedIn) {
      navigate(`/${market.toLowerCase()}/login`);
      return;
    }
    void toggle(id).catch(() => {});
  };

  if (cards.length === 0 && banners.length === 0) return null;

  const openRoom = (id: string) => navigate(`/${market.toLowerCase()}/chambre/${id}`);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="popular-listings">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">
              <i className="fa-solid fa-fire"></i>
            </span>
            Nos biens les plus demandés
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Les logements les plus réservés par nos voyageurs cette semaine.
          </p>
        </div>
        {banners.length > 0 && <MaquetteBannerCarousel banners={banners} />}
      </div>
      {cards.length > 0 && (
        <div className="relative">
        <button
          type="button"
          aria-label="Biens précédents"
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-slate-200 hidden md:flex items-center justify-center text-slate-600 hover:bg-slate-50"
        >
          <i className="fa-solid fa-chevron-left text-xs"></i>
        </button>
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <article
              key={card.id}
              className="w-[78%] flex-none snap-start bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition group cursor-pointer sm:w-auto"
              role="link"
              tabIndex={0}
              onClick={() => openRoom(card.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openRoom(card.id);
                }
              }}
            >
              <div className="relative h-40 overflow-hidden">
                {card.image && (
                  <img
                    alt={card.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    src={card.image}
                    loading="lazy"
                  />
                )}
                <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Populaire
                </span>
                <button
                  type="button"
                  aria-label={isFavorite(card.id) ? `Retirer ${card.title} des favoris` : `Sauvegarder ${card.title}`}
                  aria-pressed={isFavorite(card.id)}
                  className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center transition ${isFavorite(card.id) ? 'text-red-500' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavorite(card.id);
                  }}
                >
                  <i className={`fa-regular ${isFavorite(card.id) ? 'fa-solid' : ''} fa-heart text-xs`}></i>
                </button>
              </div>
              <div className="p-3">
                {card.location && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mb-1">
                    <i className="fa-solid fa-location-dot text-slate-400"></i>
                    <span>{card.location}</span>
                  </div>
                )}
                <h3 className="text-xs font-bold text-slate-900 truncate">{card.title}</h3>
                {card.meta.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2">
                    {card.meta.map((item) => (
                      <span key={item.label}>
                        <i className={`fa-solid ${item.icon} mr-0.5`}></i> {item.label}
                      </span>
                    ))}
                  </div>
                )}
                {card.price && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline">
                    <span className="text-xs font-extrabold text-slate-900">{card.price}</span>
                    <span className="text-[10px] text-slate-500 ml-1">{card.unit}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
        <button
          type="button"
          aria-label="Biens suivants"
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-slate-200 hidden md:flex items-center justify-center text-slate-600 hover:bg-slate-50"
        >
          <i className="fa-solid fa-chevron-right text-xs"></i>
        </button>
        </div>
      )}
    </section>
  );
}
