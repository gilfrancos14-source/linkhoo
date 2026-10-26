import type { MarketCode } from '../config/markets';
import type { Category } from '../data/categories';
import {
  apiBanners,
  apiEscapades,
  apiEvents,
  apiReviews,
  apiRooms,
  apiTourism,
  cachedGet,
  type BannerData,
  type EscapadeData,
  type EventData,
  type FeaturedReviewData,
  type RoomData,
  type TourismPartition,
} from '../lib/api';

export type MaquetteBannerSection = 'popular' | 'promos' | 'categories' | 'events';

export interface MaquetteData {
  banners: BannerData[] | null;
  popular: RoomData[] | null;
  rooms: RoomData[] | null;
  categories: Category[] | null;
  events: EventData[] | null;
  tourism: TourismPartition | null;
  escapades: EscapadeData[] | null;
  reviews: FeaturedReviewData[] | null;
}

export const EMPTY_MAQUETTE_DATA: MaquetteData = {
  banners: null,
  popular: null,
  rooms: null,
  categories: null,
  events: null,
  tourism: null,
  escapades: null,
  reviews: null,
};

export const maquetteApi = {
  banners: (market: MarketCode) => apiBanners.list(market),
  popular: (market: MarketCode) => apiRooms.getPopular(market),
  rooms: (market: MarketCode) => apiRooms.list(market),
  categories: (market: MarketCode) => cachedGet<Category[]>(`/categories?market=${market}`),
  events: (market: MarketCode) => apiEvents.list(market),
  tourism: (market: MarketCode) => apiTourism.list(market),
  escapades: (market: MarketCode) => apiEscapades.list(market),
  reviews: () => apiReviews.featured(),
};
