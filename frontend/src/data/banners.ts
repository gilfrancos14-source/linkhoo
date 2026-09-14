import type { MarketCode } from './rooms';
import { apiBanners, type BannerData } from '../lib/api';

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

function mapBanner(d: BannerData): Banner {
  return { id: d.id, section: d.section as BannerSection, img: d.img, alt: d.alt, link: d.link, market: d.market as MarketCode, order: d.order };
}

export async function fetchBannersBySection(market: MarketCode, section: BannerSection): Promise<Banner[]> {
  try {
    const data = await apiBanners.list(market);
    return data
      .map(mapBanner)
      .filter((b) => b.section === section)
      .sort((a, b) => a.order - b.order);
  } catch {
    return getLocalBanners()
      .filter((b) => b.market === market && b.section === section)
      .sort((a, b) => a.order - b.order);
  }
}

export async function fetchAllBannersByMarket(market: MarketCode): Promise<Banner[]> {
  try {
    const data = await apiBanners.list(market);
    return data.map(mapBanner);
  } catch {
    return getLocalBanners().filter((b) => b.market === market);
  }
}

export async function addBanner(banner: Omit<Banner, 'id'>): Promise<Banner> {
  const created = await apiBanners.create({
    section: banner.section,
    img: banner.img,
    alt: banner.alt,
    link: banner.link,
    market: banner.market,
    order: banner.order,
  });
  return mapBanner(created);
}

export async function updateBanner(id: string, updates: Partial<Banner>): Promise<void> {
  await apiBanners.update(id, updates);
}

export async function deleteBanner(id: string): Promise<void> {
  await apiBanners.delete(id);
}

function getLocalBanners(): Banner[] {
  try {
    return JSON.parse(localStorage.getItem('ilehya-banners') || '[]');
  } catch { return []; }
}
