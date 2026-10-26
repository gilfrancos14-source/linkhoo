import type { HeaderItem } from '../components/landing/LandingHeader';

export const MAQUETTE_NAV_ITEMS: readonly HeaderItem[] = [
  { label: 'Accueil', href: 'hero-section', active: true },
  { label: 'Appartements', href: 'popular-listings' },
  { label: 'Événements', href: 'events-section' },
  { label: 'Tourisme', href: 'tourism-section' },
  { label: 'Avis', href: 'testimonials' },
];
