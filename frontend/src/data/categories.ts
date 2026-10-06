import type { MarketCode } from '../contexts/MarketContext';
import { cachedGet } from '../lib/api';

export interface Category {
  id: string;
  title: string;
  img: string;
  alt: string;
  market: MarketCode;
}

// Modèle CI (images du seed backend) pour les marchés ouverts sans repli
// écrit à la main : ids préfixés du slug, exactement comme les catégories
// créées par `seedMarkets.ts` côté back.
const CI_MODEL: ReadonlyArray<{ key: string; title: string; img: string; alt: string }> = [
  { key: 'chambres-moins-cheres', title: 'Chambres moins chères', img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Chambres abordables' },
  { key: 'chambres-premium', title: 'Chambres premium', img: '/images/pexels-artbovich-6782567.jpg', alt: 'Chambres premium' },
  { key: 'appartements', title: 'Appartements', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Appartements' },
  { key: 'hotels', title: 'Hôtels', img: '/images/pexels-artbovich-7045712.jpg', alt: "Chambres d'hôtel" },
];

function modelCategories(market: MarketCode): Category[] {
  const slug = market.toLowerCase();
  return CI_MODEL.map((c) => ({
    id: `${slug}-${c.key}`,
    title: c.title,
    img: c.img,
    alt: c.alt,
    market,
  }));
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
  SN: modelCategories('SN'),
  TG: modelCategories('TG'),
  CM: modelCategories('CM'),
  BF: modelCategories('BF'),
  CG: modelCategories('CG'),
  GA: modelCategories('GA'),
  GN: modelCategories('GN'),
  ML: modelCategories('ML'),
  NE: modelCategories('NE'),
  CD: modelCategories('CD'),
};

export async function fetchCategoriesByMarket(market: MarketCode): Promise<Category[]> {
  try {
    const data = await cachedGet<Category[]>(`/categories?market=${market}`);
    if (Array.isArray(data) && data.length > 0) return data;
    return FALLBACK_CATEGORIES[market] ?? [];
  } catch {
    return FALLBACK_CATEGORIES[market] ?? [];
  }
}
