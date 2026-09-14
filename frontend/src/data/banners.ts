import type { MarketCode } from './rooms';

export type BannerSection = 'popular' | 'promos' | 'categories' | 'events';

export interface Banner {
  id: string;
  section: BannerSection;
  img: string;
  alt: string;
  link: string;
  market: MarketCode;
  order: number;
}

const STORAGE_KEY = 'ilehya-banners';

const defaultBanners: Banner[] = [];

function getLocalBanners(): Banner[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveLocalBanners(banners: Banner[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(banners));
}

export function getBannersByMarket(market: MarketCode): Banner[] {
  const local = getLocalBanners().filter((b) => b.market === market);
  const defaults = defaultBanners.filter((b) => b.market === market);
  return [...defaults, ...local];
}

export function getBannersBySection(market: MarketCode, section: BannerSection): Banner[] {
  return getBannersByMarket(market)
    .filter((b) => b.section === section)
    .sort((a, b) => a.order - b.order);
}

export function addBanner(banner: Omit<Banner, 'id'>): Banner {
  const newBanner: Banner = {
    ...banner,
    id: 'banner-' + Date.now(),
  };
  const all = getLocalBanners();
  all.push(newBanner);
  saveLocalBanners(all);
  return newBanner;
}

export function updateBanner(id: string, updates: Partial<Banner>): void {
  const all = getLocalBanners();
  const idx = all.findIndex((b) => b.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates };
    saveLocalBanners(all);
  }
}

export function deleteBanner(id: string): void {
  const all = getLocalBanners().filter((b) => b.id !== id);
  saveLocalBanners(all);
}
