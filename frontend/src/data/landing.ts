// Données statiques de la page d'accueil racine (structure CoinAfrique,
// contenu Linkhoo). Les catégories et les avis viennent de l'API.

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
  slug: 'ci' | 'bj' | null;
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
// de leur sélecteur. Seuls la Côte d'Ivoire et le Bénin ont un marché ouvert.
export const LANDING_COUNTRIES: LandingCountry[] = [
  { id: 'sn', label: 'Sénégal', slug: null, flag: 'sn' },
  { id: 'ci', label: 'Côte d’Ivoire', slug: 'ci', flag: 'ci' },
  { id: 'tg', label: 'Togo', slug: null, flag: 'tg' },
  { id: 'bj', label: 'Bénin', slug: 'bj', flag: 'bj' },
  { id: 'cm', label: 'Cameroun', slug: null, flag: 'cm' },
  { id: 'bf', label: 'Burkina Faso', slug: null, flag: 'bf' },
  { id: 'cg', label: 'Congo', slug: null, flag: 'cg' },
  { id: 'ga', label: 'Gabon', slug: null, flag: 'ga' },
  { id: 'gn', label: 'Guinée', slug: null, flag: 'gn' },
  { id: 'ml', label: 'Mali', slug: null, flag: 'ml' },
  { id: 'ne', label: 'Niger', slug: null, flag: 'ne' },
  { id: 'cd', label: 'RDC', slug: null, flag: 'cd' },
];
