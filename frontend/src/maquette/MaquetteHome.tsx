import { useMemo } from 'react';
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
} from './viewModel';

interface MaquetteHomeProps {
  market: MarketCode;
  data: MaquetteData;
}

export default function MaquetteHome({ market, data }: MaquetteHomeProps) {
  const banners = useMemo(() => buildBanners(data.banners), [data.banners]);
  const popular = useMemo(() => buildPopularCards(data.popular), [data.popular]);
  const promos = useMemo(() => buildPromos(data.rooms), [data.rooms]);
  const categories = useMemo(
    () => buildCategoryCards(data.categories, data.rooms),
    [data.categories, data.rooms],
  );
  const events = useMemo(() => buildEvents(data.events), [data.events]);
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
