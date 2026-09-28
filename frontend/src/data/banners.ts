import type { MarketCode } from '../contexts/MarketContext';
import { apiBanners, type BannerData } from '../lib/api';

type BannerSection = 'popular' | 'promos' | 'categories' | 'events';

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
  const data = await apiBanners.list(market);
  return data
    .map(mapBanner)
    .filter((b) => b.section === section)
    .sort((a, b) => a.order - b.order);
}


