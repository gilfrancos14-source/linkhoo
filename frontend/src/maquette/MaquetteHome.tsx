import { useEffect, useMemo, useRef } from 'react';
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
import './maquette-reveal.css';
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // On arme les ENFANTS de chaque groupe (les cartes), pas le groupe entier :
    // chaque carte apparaît quand elle entre elle-même dans le viewport.
    const groups = Array.from(root.querySelectorAll<HTMLElement>('.mq-reveal-group'));
    const cards: HTMLElement[] = [];
    for (const group of groups) {
      group.classList.add('mq-reveal-armed');
      Array.from(group.children).forEach((child, index) => {
        const card = child as HTMLElement;
        // Si plusieurs cartes entrent en même temps, on garde un décalage de
        // 1 seconde pour l'effet « une par une ».
        card.style.transitionDelay = `${Math.min(index, 8) * 1}s`;
        cards.push(card);
      });
    }

    if (!('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const card = entry.target as HTMLElement;
          card.classList.add('is-visible');
          observer.unobserve(card);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -24px 0px' },
    );

    // Ré-observation à chaque chargement de données : les cartes créées après
    // un rendu précédent (sections vides au départ) doivent aussi être armées.
    cards.forEach((card) => {
      if (!card.classList.contains('is-visible')) observer.observe(card);
    });
    return () => observer.disconnect();
  }, [data]);

  return (
    <div ref={rootRef} className="maquette-home bg-[#F8FAFC] text-slate-800 font-sans antialiased selection:bg-[color:var(--market-accent)] selection:text-white">
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
