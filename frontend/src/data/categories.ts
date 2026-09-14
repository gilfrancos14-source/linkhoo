import type { MarketCode } from './rooms';
import { apiCategories, type CategoryData } from '../lib/api';

export interface Category {
  id: string;
  title: string;
  img: string;
  alt: string;
  market: MarketCode;
}

function mapCategory(d: CategoryData): Category {
  return { id: d.id, title: d.title, img: d.img, alt: d.alt, market: d.market as MarketCode };
}

export async function fetchCategoriesByMarket(market: MarketCode): Promise<Category[]> {
  try {
    const data = await apiCategories.list(market);
    return data.map(mapCategory);
  } catch {
    return getLocalCategories().filter((c) => c.market === market);
  }
}

export async function addCategory(cat: Omit<Category, 'id'>): Promise<Category> {
  const created = await apiCategories.create({ title: cat.title, img: cat.img, alt: cat.alt, market: cat.market });
  return mapCategory(created);
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  await apiCategories.update(id, updates);
}

export async function deleteCategory(id: string): Promise<void> {
  await apiCategories.delete(id);
}

function getLocalCategories(): Category[] {
  try {
    return JSON.parse(localStorage.getItem('ilehya-categories') || '[]');
  } catch { return []; }
}
