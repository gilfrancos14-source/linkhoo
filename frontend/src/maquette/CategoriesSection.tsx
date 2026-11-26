import MaquetteBannerCarousel from './MaquetteBannerCarousel';
import { useTranslation } from 'react-i18next';
import TranslationReport from '../components/TranslationReport';
import type { BannerSlide, CategoryCard } from './viewModel';

interface CategoriesSectionProps {
  cards: CategoryCard[];
  banners: BannerSlide[];
}

const BADGES = [
  { className: 'bg-[color:var(--market-accent)]', icon: 'fa-building' },
  { className: 'bg-[color:var(--market-accent-dark)]', icon: 'fa-tree-city' },
  { className: 'bg-[color:var(--market-accent)]', icon: 'fa-house' },
  { className: 'bg-[color:var(--market-accent-dark)]', icon: 'fa-bed' },
  { className: 'bg-[color:var(--market-accent)]', icon: 'fa-door-open' },
  { className: 'bg-[color:var(--market-accent-dark)]', icon: 'fa-city' },
] as const;

const GRID_BY_COUNT: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export default function CategoriesSection({ cards, banners }: CategoriesSectionProps) {
  const { t } = useTranslation();
  if (cards.length === 0 && banners.length === 0) return null;

  const gridCols = GRID_BY_COUNT[cards.length] ?? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="categories-section">
      <div className="mq-reveal-group flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-[color:var(--market-accent)]">
              <i className="fa-solid fa-shapes"></i>
            </span>
            {t('categories.sectionTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('categories.subtitle')}
          </p>
        </div>
        <MaquetteBannerCarousel banners={banners} />
      </div>
      {cards.length > 0 && (
        <div className={`mq-reveal-group grid ${gridCols} gap-3`}>
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
                  {card.count} {t('categories.property', { count: card.count })}
                </p>
                <TranslationReport
                  entityId={card.id}
                  entityType="category"
                  field="title"
                  currentValue={card.title}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
