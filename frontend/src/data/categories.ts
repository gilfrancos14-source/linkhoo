import type { MarketCode } from '../contexts/MarketContext';
import { request } from '../lib/api';

export interface Category {
  id: string;
  title: string;
  img: string;
  alt: string;
  market: MarketCode;
}

const FALLBACK_CATEGORIES: Record<MarketCode, Category[]> = {
  CI: [
    { id: 'ci-chambres-moins-chères', title: 'Chambres moins chères', img: '/images/pexels-artbovich-6283961.jpg', alt: 'Chambres abordables', market: 'CI' },
    { id: 'ci-chambres-premium', title: 'Chambres premium', img: '/images/pexels-artbovich-6315808.jpg', alt: 'Chambres premium', market: 'CI' },
    { id: 'ci-appartements', title: 'Appartements', img: '/images/pexels-artbovich-6782567.jpg', alt: 'Appartements', market: 'CI' },
    { id: 'ci-hotels', title: 'Hôtels', img: '/images/pexels-artbovich-5998117.jpg', alt: "Chambres d'hôtel", market: 'CI' },
  ],
  BJ: [
    { id: 'appartements-moins-chers', title: 'Appartements moins chers', img: '/images/pexels-artbovich-5998120.jpg', alt: 'Appartements abordables', market: 'BJ' },
    { id: 'hotel', title: 'Hôtels', img: '/images/pexels-artbovich-5998117.jpg', alt: "Chambres d'hôtel", market: 'BJ' },
    { id: 'appartements-premium', title: 'Appartements premium', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Appartements premium', market: 'BJ' },
  ],
};

export async function fetchCategoriesByMarket(market: MarketCode): Promise<Category[]> {
  try {
    const data = await request<Category[]>(`/categories?market=${market}`);
    if (Array.isArray(data) && data.length > 0) return data;
    return FALLBACK_CATEGORIES[market] ?? [];
  } catch {
    return FALLBACK_CATEGORIES[market] ?? [];
  }
}
