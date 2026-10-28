import MaquetteBannerCarousel from './MaquetteBannerCarousel';
import type { BannerSlide, CategoryCard } from './viewModel';

interface CategoriesSectionProps {
  cards: CategoryCard[];
  banners: BannerSlide[];
}

const BADGES = [
  { className: 'bg-[#FF5E1E]', icon: 'fa-building' },
  { className: 'bg-cyan-600', icon: 'fa-tree-city' },
  { className: 'bg-amber-500', icon: 'fa-house' },
  { className: 'bg-indigo-600', icon: 'fa-bed' },
  { className: 'bg-emerald-600', icon: 'fa-door-open' },
  { className: 'bg-teal-600', icon: 'fa-city' },
] as const;

const GRID_BY_COUNT: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export default function CategoriesSection({ cards, banners }: CategoriesSectionProps) {
  if (cards.length === 0 && banners.length === 0) return null;

  const gridCols = GRID_BY_COUNT[cards.length] ?? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="categories-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">
              <i className="fa-solid fa-shapes"></i>
            </span>
            Catégories
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Trouvez facilement le type de logement qui vous correspond.
          </p>
        </div>
        <MaquetteBannerCarousel banners={banners} />
      </div>
      {cards.length > 0 && (
        <div className={`grid ${gridCols} gap-3`}>
          {cards.map((card, index) => {
            const badge = BADGES[index % BADGES.length];
            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm transition text-center"
              >
                <div className="relative h-32 rounded-xl overflow-hidden mb-2">
                  {card.image && (
                    <img
                      alt={card.alt}
                      className="w-full h-full object-cover"
                      src={card.image}
                      loading="lazy"
                    />
                  )}
                  <span
                    className={`absolute bottom-1.5 left-1.5 w-6 h-6 rounded-full ${badge.className} text-white text-[10px] flex items-center justify-center`}
                  >
                    <i className={`fa-solid ${badge.icon}`}></i>
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900">{card.title}</p>
                <p className="text-[10px] text-slate-400">
                  {card.count} bien{card.count > 1 ? 's' : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
