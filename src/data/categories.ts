import type { MarketCode } from './rooms';

export interface Category {
  id: string;
  title: string;
  img: string;
  alt: string;
  market: MarketCode;
}

const defaultCategories: Category[] = [
  { id: 'appartements-moins-chers', title: 'Appartements moins chers', img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Appartement lumineux au meilleur prix', market: 'BJ' },
  { id: 'appartements-premium', title: 'Appartements premium', img: '/images/pexels-donaldtong94-189333.jpg', alt: 'Appartement premium avec salon spacieux', market: 'BJ' },
  { id: 'villas-premium', title: 'Villas premium', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Villa premium avec jardin', market: 'BJ' },
  { id: 'hotel', title: 'Hôtel', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Suite hôtelière avec vue mer', market: 'BJ' },
  { id: 'ci-chambres-moins-chères', title: 'Chambres moins chères', img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Chambre simple et abordable', market: 'CI' },
  { id: 'ci-chambres-premium', title: 'Chambres premium', img: '/images/pexels-artbovich-6782567.jpg', alt: 'Chambre premium bien équipée', market: 'CI' },
  { id: 'ci-appartements', title: 'Appartements', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Appartement spacieux', market: 'CI' },
  { id: 'ci-hotel', title: 'Hôtel', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Suite hôtelière', market: 'CI' },
];

const STORAGE_KEY = 'ilehya-categories';

function getLocalCategories(): Category[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveLocalCategories(cats: Category[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
}

export function getCategoriesByMarket(market: MarketCode): Category[] {
  const local = getLocalCategories().filter((c) => c.market === market);
  const defaults = defaultCategories.filter((c) => c.market === market);
  return [...defaults, ...local];
}

export function addCategory(cat: Omit<Category, 'id'>): Category {
  const newCat: Category = {
    ...cat,
    id: cat.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  };
  const all = getLocalCategories();
  all.push(newCat);
  saveLocalCategories(all);
  return newCat;
}

export function updateCategory(id: string, updates: Partial<Category>): void {
  const all = getLocalCategories();
  const idx = all.findIndex((c) => c.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates };
    saveLocalCategories(all);
  }
}

export function deleteCategory(id: string): void {
  const all = getLocalCategories().filter((c) => c.id !== id);
  saveLocalCategories(all);
}
