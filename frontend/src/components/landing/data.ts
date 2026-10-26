import { MARKETS, type MarketCode } from '../../config/markets';

export interface Country {
  readonly code: MarketCode;
  readonly label: string;
  readonly flag: string;
  readonly marketSlug?: string;
}

const flagImage = (slug: string) => `url('/flags/${slug}.png') center/cover no-repeat`;

export const COUNTRIES: readonly Country[] = MARKETS.map((market) => ({
  code: market.code,
  label: market.label,
  flag: flagImage(market.slug),
  marketSlug: market.slug,
}));

export const DEFAULT_COUNTRY = COUNTRIES.find((item) => item.code === 'CI') ?? COUNTRIES[0];

export interface Listing {
  readonly id: string;
  readonly location: string;
  readonly title: string;
  readonly rating: string;
  readonly reviews: string;
  readonly price: string;
  readonly image: string;
  readonly imageAlt: string;
}

export const LISTINGS: readonly Listing[] = [
  {
    id: 'cocody',
    location: 'Abidjan, CI',
    title: 'Studio moderne à Cocody',
    rating: '4.8',
    reviews: '124',
    price: '25 000',
    image: '/images/listings/cocody.jpg',
    imageAlt: "Salon lumineux d'un studio moderne",
  },
  {
    id: 'grand-bassam',
    location: 'Grand-Bassam, CI',
    title: 'Villa avec piscine',
    rating: '4.9',
    reviews: '87',
    price: '75 000',
    image: '/images/listings/grand-bassam.jpg',
    imageAlt: 'Villa contemporaine avec piscine',
  },
  {
    id: 'yamoussoukro',
    location: 'Yamoussoukro, CI',
    title: 'Chambre privée climatisée',
    rating: '4.7',
    reviews: '96',
    price: '18 000',
    image: '/images/listings/yamoussoukro.jpg',
    imageAlt: 'Chambre privée climatisée',
  },
  {
    id: 'san-pedro',
    location: 'San Pedro, CI',
    title: 'Appartement vue mer',
    rating: '4.6',
    reviews: '73',
    price: '40 000',
    image: '/images/listings/san-pedro.jpg',
    imageAlt: 'Appartement ouvert sur une terrasse',
  },
  {
    id: 'bingerville',
    location: 'Bingerville, CI',
    title: 'Studio cosy',
    rating: '4.8',
    reviews: '102',
    price: '22 000',
    image: '/images/listings/bingerville.jpg',
    imageAlt: 'Salon cosy avec canapé bleu',
  },
  {
    id: 'assinie',
    location: 'Assinie, CI',
    title: 'Villa de luxe',
    rating: '4.9',
    reviews: '63',
    price: '120 000',
    image: '/images/listings/assinie.jpg',
    imageAlt: 'Villa de luxe en bord de mer',
  },
];

const slideImage = (name: string) =>
  `linear-gradient(90deg,rgba(15,10,10,.78),rgba(15,10,10,.1) 60%),url('/images/cities/${name}.jpg') center/cover no-repeat`;

export const SLIDES: readonly string[] = [
  slideImage('abidjan'),
  slideImage('dakar'),
  slideImage('lome'),
  slideImage('cotonou'),
];

export interface Review {
  readonly id: string;
  readonly initials: string;
  readonly name: string;
  readonly stay: string;
  readonly rating: string;
  readonly text: string;
}

export const REVIEWS: readonly Review[] = [
  {
    id: 'adama',
    initials: 'AD',
    name: 'Adama Diallo',
    stay: 'Séjour à Abidjan, CI',
    rating: '5.0',
    text: "Super expérience ! L'appartement était propre, bien situé et l'hôte très accueillant. Je recommande à 100% !",
  },
  {
    id: 'mariama',
    initials: 'MK',
    name: 'Mariama Koné',
    stay: 'Séjour à Grand-Bassam, CI',
    rating: '4.8',
    text: 'Un cadre magnifique, idéal pour se reposer. La plage est à quelques minutes. Je reviendrai sans hésiter !',
  },
  {
    id: 'brice',
    initials: 'BT',
    name: 'Brice Tchibozo',
    stay: 'Séjour à Lomé, TG',
    rating: '4.9',
    text: 'Très bon rapport qualité/prix. Le logement correspondait exactement aux photos. Service au top !',
  },
  {
    id: 'fatou',
    initials: 'FD',
    name: 'Fatou Diop',
    stay: 'Séjour à Dakar, SN',
    rating: '4.7',
    text: "Je suis restée 5 jours et tout s'est très bien passé. L'hôte est disponible et très sympa.",
  },
  {
    id: 'issa',
    initials: 'IL',
    name: 'Issa Lamine',
    stay: 'Séjour à Cotonou, BJ',
    rating: '4.8',
    text: 'Logement propre, confortable et bien équipé. Je recommande Linkhoo pour vos séjours !',
  },
  {
    id: 'sophie',
    initials: 'SL',
    name: 'Sophie Laurent',
    stay: 'Séjour à Accra, GH',
    rating: '5.0',
    text: "Une expérience incroyable ! L'emplacement est parfait et le service client est réactif.",
  },
];
