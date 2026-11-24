import type { HeaderItem } from '../components/landing/LandingHeader';

export const MAQUETTE_NAV_ITEMS: readonly HeaderItem[] = [
  { label: 'Accueil', labelKey: 'navigation.home', href: 'hero-section', active: true },
  { label: 'Appartements', labelKey: 'categories.title', href: 'popular-listings' },
  { label: 'Événements', labelKey: 'events.title', href: 'events-section' },
  { label: 'Tourisme', labelKey: 'tourism.title', href: 'tourism-section' },
  { label: 'Avis', labelKey: 'reviews.title', href: 'testimonials' },
];
