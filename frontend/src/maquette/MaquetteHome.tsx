import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketCode } from '../config/markets';
import CategoriesSection from './CategoriesSection';
import EscapadesSection from './EscapadesSection';
import EventsSection from './EventsSection';
import HeroSection from './HeroSection';
import PopularSection from './PopularSection';
import PromosSection from './PromosSection';
import ReviewsSection from './ReviewsSection';
import TourismSection from './TourismSection';
import type { MaquetteData } from './maquetteApi';
import {
  buildBanners,
  buildCategoryCards,
  buildEscapades,
  buildEvents,
  buildPopularCards,
  buildPromos,
  buildReviews,
  buildTourism,
  type TranslateFn,
} from './viewModel';

interface MaquetteHomeProps {
  market: MarketCode;
  data: MaquetteData;
}

export default function MaquetteHome({ market, data }: MaquetteHomeProps) {
  const { i18n, t } = useTranslation();
  const language = i18n.language.split('-')[0];
  // `t` d'i18next a des surcharges très strictes ; notre surface est
  // volontairement réduite à (clé, options) -> chaîne pour le view model.
  const translate = t as unknown as TranslateFn;

  const banners = useMemo(
    () => buildBanners(data.banners, translate),
    [data.banners, translate],
  );
  const popular = useMemo(
    () => buildPopularCards(data.popular, translate),
    [data.popular, translate],
  );
  const promos = useMemo(
    () => buildPromos(data.rooms, new Date(), translate),
    [data.rooms, translate],
  );
  const categories = useMemo(
    () => buildCategoryCards(data.categories, data.rooms),
    [data.categories, data.rooms],
  );
  const events = useMemo(
    () => buildEvents(data.events, language),
    [data.events, language],
  );
  const tourism = useMemo(() => buildTourism(data.tourism, data.rooms), [data.tourism, data.rooms]);
  const escapades = useMemo(() => buildEscapades(data.escapades), [data.escapades]);
  const reviews = useMemo(() => buildReviews(data.reviews, market), [data.reviews, market]);

  return (
    <div className="maquette-home bg-[#F8FAFC] text-slate-800 font-sans antialiased selection:bg-orange-500 selection:text-white">
      <HeroSection market={market} />
      <PopularSection market={market} cards={popular} banners={banners.popular} />
      <PromosSection market={market} cards={promos} banners={banners.promos} />
      <CategoriesSection cards={categories} banners={banners.categories} />
      <EventsSection
        market={market}
        cities={events.cities}
        featuredEvents={events.featuredEvents}
        banners={banners.events}
      />
      <TourismSection market={market} view={tourism} />
      <EscapadesSection market={market} cards={escapades} />
      <ReviewsSection reviews={reviews} />
    </div>
  );
}
