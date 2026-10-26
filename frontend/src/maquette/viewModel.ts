import type { MarketCode } from '../config/markets';
import type { Category } from '../data/categories';
import { priceWithCurrency } from '../lib/roomDisplay';
import type {
  BannerData,
  DestinationData,
  EscapadeData,
  EventData,
  FeaturedReviewData,
  RoomData,
  TourismPartition,
} from '../lib/api';
import type { MaquetteBannerSection } from './maquetteApi';

export interface BannerSlide {
  id: string;
  image: string;
  alt: string;
  link: string;
}

export type BannerSlides = Record<MaquetteBannerSection, BannerSlide[]>;

export interface HomeBadge {
  label: string;
  className: string;
}

export interface PopularCard {
  id: string;
  image: string;
  alt: string;
  location: string;
  title: string;
  meta: { icon: string; label: string }[];
  price: string;
  unit: string;
}

export interface PromoCard {
  key: string;
  badge: string;
  badgeClassName: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  featureTitle: string;
  description: string;
  rooms: PromoMiniCard[];
}

export interface PromoMiniCard {
  id: string;
  image: string;
  alt: string;
  title: string;
  price: string;
}

export interface CategoryCard {
  id: string;
  title: string;
  image: string;
  alt: string;
  count: number;
}

export interface CityEventCard {
  city: string;
  image: string;
  alt: string;
  count: number;
}

export interface FeaturedEvent {
  id: string;
  image: string;
  alt: string;
  title: string;
  city: string;
  date: string;
  description: string;
}

export interface TourismCard {
  id: string;
  city: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  count: number;
}

export interface TourismView {
  // Grande image de fond de la carte de gauche (design inchangé).
  bannerImage: string;
  // Grandes cartes servies par le serveur : elles défilent dans la carte
  // longue de droite (une à la suite de l'autre).
  longCards: TourismCard[];
  // Petites cartes : la grille de droite. Aucun mélange avec les grandes.
  minis: TourismCard[];
}

export interface EscapadeCard {
  id: string;
  lieu: string;
  text: string;
  cover: string;
}

export interface ReviewCard {
  id: string;
  initials: string;
  rating: number;
  comment: string;
  name: string;
  city: string | null;
}

const EMPTY_BANNERS: BannerSlides = {
  popular: [],
  promos: [],
  categories: [],
  events: [],
};

export function buildBanners(banners: BannerData[] | null): BannerSlides {
  if (!banners) return EMPTY_BANNERS;

  const slides: BannerSlides = {
    popular: [],
    promos: [],
    categories: [],
    events: [],
  };

  const ordered = [...banners].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const banner of ordered) {
    const section = banner.section as MaquetteBannerSection;
    if (!slides[section]) continue;
    slides[section].push({
      id: banner.id,
      image: banner.img,
      alt: banner.alt || 'Bannière promotionnelle',
      link: banner.link,
    });
  }

  return slides;
}

const PROMO_GROUPS = [
  {
    key: 'promo_15',
    badge: '-15%',
    badgeClassName: 'bg-[#FF5E1E]',
    title: 'Villas et appartements',
    featureTitle: 'Villas et appartements',
    text: 'Des séjours spacieux à prix réduit',
    description: 'Profitez de -15% sur une sélection de villas et d’appartements spacieux.',
  },
  {
    key: 'promo_10',
    badge: '-10%',
    badgeClassName: 'bg-emerald-600',
    title: 'Escapades en famille',
    featureTitle: 'Escapades en famille',
    text: 'Des logements confortables pour toute la famille',
    description: 'Profitez de -10% sur des logements confortables à partager en famille.',
  },
  {
    key: 'promo_5',
    badge: '-5%',
    badgeClassName: 'bg-purple-600',
    title: 'Dernière minute',
    featureTitle: 'Dernière minute',
    text: 'Les dernières disponibilités à saisir',
    description: 'Profitez de -5% sur les dernières disponibilités.',
  },
] as const;

function isPromoActive(room: RoomData, now: Date): boolean {
  if (!room.promo_group) return false;
  if (room.promo_start) {
    const start = new Date(room.promo_start);
    if (!Number.isNaN(start.getTime()) && start > now) return false;
  }
  if (room.promo_end) {
    const raw = room.promo_end.length === 10 ? `${room.promo_end}T23:59:59` : room.promo_end;
    const end = new Date(raw);
    if (!Number.isNaN(end.getTime()) && end < now) return false;
  }
  return true;
}

function priceOf(room: RoomData): string {
  return priceWithCurrency(room.price_num || room.price, room.price_unit);
}

function unitOf(room: RoomData): string {
  return room.price_unit || '/nuit';
}

function locationOf(room: RoomData): string {
  return [room.ville, room.quartier].map((value) => value.trim()).filter(Boolean).join(' - ');
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return (`${first.charAt(0)}${last.charAt(0)}`).toUpperCase() || '?';
}

export function buildPopularCards(rooms: RoomData[] | null): PopularCard[] {
  if (!rooms) return [];
  return rooms.slice(0, 5).map((room) => {
    const meta: { icon: string; label: string }[] = [];
    if (room.chambres > 0) {
      meta.push({
        icon: 'fa-bed',
        label: `${room.chambres} chambre${room.chambres > 1 ? 's' : ''}`,
      });
    }
    if (room.douches > 0) {
      meta.push({ icon: 'fa-shower', label: `${room.douches} sdb` });
    }
    return {
      id: room.id,
      image: room.img,
      alt: room.alt || room.title,
      location: locationOf(room),
      title: room.title,
      meta,
      price: priceOf(room),
      unit: unitOf(room),
    };
  });
}

export function buildCategoryCards(
  categories: Category[] | null,
  rooms: RoomData[] | null,
): CategoryCard[] {
  if (!categories) return [];
  const catalogue = rooms ?? [];
  return categories.map((category) => ({
    id: category.id,
    title: category.title,
    image: category.img,
    alt: category.alt || category.title,
    count: catalogue.filter((room) => room.category === category.id).length,
  }));
}

function miniCardOf(room: RoomData): PromoMiniCard {
  return {
    id: room.id,
    image: room.img,
    alt: room.alt || room.title,
    title: room.title,
    price: priceOf(room),
  };
}

export function buildPromos(rooms: RoomData[] | null, now = new Date()): PromoCard[] {
  const catalogue = rooms ?? [];
  const active = catalogue.filter((room) => isPromoActive(room, now));

  return PROMO_GROUPS.map((group) => {
    const groupRooms = active.filter((room) => room.promo_group === group.key);
    const first = groupRooms[0];

    return {
      key: group.key,
      badge: group.badge,
      badgeClassName: group.badgeClassName,
      title: group.title,
      text: group.text,
      image: first?.img ?? '',
      alt: first?.alt || group.title,
      featureTitle: group.featureTitle,
      description: group.description,
      rooms: groupRooms.slice(0, 3).map(miniCardOf),
    };
  });
}

function dateOf(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatMaquetteDate(isoDate: string): string {
  return dateOf(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function buildEvents(events: EventData[] | null): {
  cities: CityEventCard[];
  featured: FeaturedEvent | null;
  featuredEvents: FeaturedEvent[];
} {
  if (!events || events.length === 0) {
    return { cities: [], featured: null, featuredEvents: [] };
  }

  const byCity = new Map<string, EventData[]>();
  for (const event of events) {
    const list = byCity.get(event.city);
    if (list) list.push(event);
    else byCity.set(event.city, [event]);
  }

  const cities: CityEventCard[] = [];
  for (const [city, list] of byCity) {
    const cover = [...list].sort(
      (a, b) => dateOf(a.event_date).getTime() - dateOf(b.event_date).getTime(),
    )[0];
    cities.push({
      city,
      image: cover.img ?? '',
      alt: cover.alt || cover.title,
      count: list.length,
    });
  }

  const sortedEvents = [...events].sort(
    (a, b) => dateOf(a.event_date).getTime() - dateOf(b.event_date).getTime(),
  );
  const featuredEvents: FeaturedEvent[] = sortedEvents.map((event) => ({
    id: event.id,
    image: event.img ?? '',
    alt: event.alt || event.title,
    title: event.title,
    city: event.city,
    date: formatMaquetteDate(event.event_date),
    description: event.description,
  }));

  return {
    cities: cities.slice(0, 4),
    featured: featuredEvents[0] ?? null,
    featuredEvents,
  };
}

function cityRoomCount(rooms: RoomData[] | null, city: string): number {
  if (!rooms) return 0;
  const target = city.trim().toLowerCase();
  return rooms.filter((room) => room.ville.trim().toLowerCase() === target).length;
}

export function buildTourism(
  tourism: TourismPartition | null,
  rooms: RoomData[] | null,
): TourismView | null {
  if (!tourism) return null;

  const toCard = (destination: DestinationData): TourismCard => ({
    id: destination.id,
    city: destination.city,
    title: destination.title,
    text: destination.description,
    image: destination.img,
    alt: destination.alt || destination.title,
    count: cityRoomCount(rooms, destination.city),
  });

  const big = tourism.big.map(toCard);
  const small = tourism.small.map(toCard);
  if (big.length === 0 && small.length === 0) return null;

  // Les grandes cartes remplissent la carte longue. Sans grande carte, on
  // garde le design de la section : la première petite carte occupe la carte
  // longue et les suivantes la grille.
  const longCards = big.length > 0 ? big : small.slice(0, 1);
  const minis = big.length > 0 ? small.slice(0, 4) : small.slice(1, 5);

  return {
    bannerImage: longCards[0]?.image ?? '',
    longCards,
    minis,
  };
}

export function buildEscapades(escapades: EscapadeData[] | null): EscapadeCard[] {
  if (!escapades) return [];
  return escapades
    .map((escapade) => ({
      id: escapade.id,
      lieu: escapade.lieu,
      text: escapade.description,
      cover: Array.isArray(escapade.images) ? escapade.images[0] ?? '' : '',
    }))
    .filter((escapade) => escapade.cover.length > 0)
    .slice(0, 4);
}

export function buildReviews(
  reviews: FeaturedReviewData[] | null,
  market: MarketCode,
): ReviewCard[] {
  if (!reviews) return [];
  return reviews
    .filter((review) => !review.room?.market || review.room.market === market)
    .slice(0, 3)
    .map((review) => ({
      id: review.id,
      initials: initialsOf(review.client_name),
      rating: Math.max(0, Math.min(5, Math.round(review.note_appartement))),
      comment: review.commentaire,
      name: review.client_name,
      city: review.room?.ville ?? null,
    }));
}
