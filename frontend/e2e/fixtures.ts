import type { Page, Route } from '@playwright/test';

/**
 * Parcours E2E sans backend : toutes les appels `/api/**` sont interceptées
 * côté navigateur, le serveur de dev Vite sert uniquement le bundle.
 */

export function makeRoom(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rm-1',
    title: 'Studio Cocody Riviera',
    subtitle: 'Calme et lumineux',
    info: 'Studio meublé proche des commerces',
    price: '25 000',
    price_num: 25000,
    price_unit: '/ nuit',
    img: '/images/pexels-artbovich-6283961.jpg',
    alt: 'Studio meublé à Cocody',
    images: ['/images/pexels-artbovich-6283961.jpg'],
    description: 'Un studio idéal pour un séjour court à Abidjan.',
    capacity: '2 personnes',
    category: 'ci-chambres-moins-cheres',
    market: 'CI',
    pays: 'Côte d\u2019Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    date_dispo: '2026-10-01',
    conditions: 'Annulation gratuite 48 h avant l\u2019arrivée',
    is_popular: true,
    ...overrides,
  };
}

export const ciRooms: Record<string, unknown>[] = [
  makeRoom({ id: 'rm-1', title: 'Studio Cocody Riviera', ville: 'Abidjan', quartier: 'Cocody' }),
  makeRoom({
    id: 'rm-2',
    title: 'Appartement Plateau Vue Mer',
    ville: 'Abidjan',
    quartier: 'Plateau',
    price: '45 000',
    price_num: 45000,
    category: 'ci-appartements',
  }),
  makeRoom({
    id: 'rm-3',
    title: 'Chambre Bouaké Centre',
    ville: 'Bouaké',
    quartier: 'Centre',
    price: '15 000',
    price_num: 15000,
  }),
];

export const ciCategories: Record<string, unknown>[] = [
  { id: 'ci-chambres-moins-cheres', title: 'Chambres moins chères', market: 'CI' },
  { id: 'ci-appartements', title: 'Appartements', market: 'CI' },
];

const reviewsResponse = {
  reviews: [],
  room_avg: 4.5,
  room_count: 12,
  gerant_avg: 4.7,
  gerant_count: 8,
};

async function respond(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = route.request().method();

    if (method === 'POST' && path === '/reservations') {
      return respond(route, { id: 'res-1', statut: 'en_attente' }, 201);
    }
    if (method !== 'GET') {
      return respond(route, {});
    }

    if (path === '/reviews') return respond(route, reviewsResponse);
    if (path === '/reviews/featured') return respond(route, []);
    if (path === '/rooms/popular') return respond(route, ciRooms);
    if (path === '/rooms/available') return respond(route, ciRooms);
    if (path === '/rooms') return respond(route, ciRooms);
    if (path.startsWith('/rooms/')) {
      const id = decodeURIComponent(path.slice('/rooms/'.length));
      const room = ciRooms.find((r) => r.id === id);
      return respond(route, room ?? {}, room ? 200 : 404);
    }
    if (path === '/categories') return respond(route, ciCategories);
    if (path === '/banners') return respond(route, []);
    if (path === '/events') return respond(route, []);
    if (path.startsWith('/notifications')) return respond(route, []);
    if (path === '/auth/me') {
      return respond(route, { role: null, client: null, gerant: null });
    }
    return respond(route, {});
  });
}
