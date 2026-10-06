// Données statiques de la page d'accueil racine (structure CoinAfrique,
// contenu Linkhoo). Les catégories et les avis viennent de l'API.

import type { MarketSlug } from '../config/markets';

export interface LandingSlide {
  id: string;
  img: string;
  alt: string;
}

export type LandingFlagId =
  | 'sn'
  | 'ci'
  | 'tg'
  | 'bj'
  | 'cm'
  | 'bf'
  | 'cg'
  | 'ga'
  | 'gn'
  | 'ml'
  | 'ne'
  | 'cd';

export interface LandingCountry {
  id: string;
  label: string;
  /** Slug du marché actif, ou null pour un pays à venir. */
  slug: MarketSlug | null;
  flag: LandingFlagId;
}

export const LANDING_SLIDES: LandingSlide[] = [
  {
    id: 'slide-chambres',
    img: '/images/1.jpg',
    alt: 'Chambre lumineuse prête pour un séjour',
  },
  {
    id: 'slide-appartements',
    img: '/images/4.jpg',
    alt: 'Appartement confortable au quotidien',
  },
  {
    id: 'slide-ouidah',
    img: '/images/ouidah.jpg',
    alt: 'Découverte d’Ouidah au Bénin',
  },
  {
    id: 'slide-tori',
    img: '/images/tori.jpg',
    alt: 'Évasion en bord de mer',
  },
];

// Grille « Choisissez un Pays » : les 12 pays de CoinAfrique, dans l'ordre
// de leur sélecteur. Les 12 marchés sont ouverts (slug = segment d'URL du
// registre config/markets.ts) ; `slug: null` reste possible pour un pays
// à venir (affichage « Bientôt » automatique dans CountrySelector).
export const LANDING_COUNTRIES: LandingCountry[] = [
  { id: 'sn', label: 'Sénégal', slug: 'sn', flag: 'sn' },
  { id: 'ci', label: 'Côte d’Ivoire', slug: 'ci', flag: 'ci' },
  { id: 'tg', label: 'Togo', slug: 'tg', flag: 'tg' },
  { id: 'bj', label: 'Bénin', slug: 'bj', flag: 'bj' },
  { id: 'cm', label: 'Cameroun', slug: 'cm', flag: 'cm' },
  { id: 'bf', label: 'Burkina Faso', slug: 'bf', flag: 'bf' },
  { id: 'cg', label: 'Congo', slug: 'cg', flag: 'cg' },
  { id: 'ga', label: 'Gabon', slug: 'ga', flag: 'ga' },
  { id: 'gn', label: 'Guinée', slug: 'gn', flag: 'gn' },
  { id: 'ml', label: 'Mali', slug: 'ml', flag: 'ml' },
  { id: 'ne', label: 'Niger', slug: 'ne', flag: 'ne' },
  { id: 'cd', label: 'RDC', slug: 'cd', flag: 'cd' },
];
