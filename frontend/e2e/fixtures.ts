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

export const bjRooms: Record<string, unknown>[] = [
  makeRoom({
    id: 'bj-1',
    title: 'Appartement Cotonou Haie Vive',
    ville: 'Cotonou',
    quartier: 'Haie Vive',
    market: 'BJ',
    pays: 'Bénin',
    category: 'appartements-moins-chers',
    price: '20 000',
    price_num: 20000,
  }),
  makeRoom({
    id: 'bj-2',
    title: 'Chambre Porto-Novo Centre',
    ville: 'Porto-Novo',
    quartier: 'Centre',
    market: 'BJ',
    pays: 'Bénin',
    category: 'appartements-moins-chers',
    price: '12 000',
    price_num: 12000,
    disponible: false,
  }),
];

export const ciCategories: Record<string, unknown>[] = [
  { id: 'ci-chambres-moins-cheres', title: 'Chambres moins chères', market: 'CI' },
  { id: 'ci-appartements', title: 'Appartements', market: 'CI' },
];

export const bjCategories: Record<string, unknown>[] = [
  { id: 'appartements-moins-chers', title: 'Appartements moins chers', market: 'BJ' },
  { id: 'hotel', title: 'Hôtels', market: 'BJ' },
];

const reviewsResponse = {
  reviews: [],
  room_avg: 4.5,
  room_count: 12,
  gerant_avg: 4.7,
  gerant_count: 8,
};

const adminMeResponse = {
  id: 'adm-1',
  email: 'admin@linkhoo.com',
  nom: 'Linkhoo',
  prenom: 'Awa',
};

const adminStatsResponse = {
  gerants: {
    total: 4,
    verified: 2,
    pendingVerifications: 1,
    premium: 1,
    byMarket: { CI: 3, BJ: 1 },
    newThisMonth: 1,
  },
  rooms: { total: 3, available: 2, unavailable: 1 },
  reservations: { total: 5, pending: 2, confirmed: 2, cancelled: 1, totalRevenue: 125000 },
};

export interface MockApiOptions {
  /** Chambres servies quel que soit le marché demandé (test de pagination…). */
  rooms?: Record<string, unknown>[];
  /** Catégories servies quel que soit le marché demandé. */
  categories?: Record<string, unknown>[];
  /** Rôle renvoyé par POST /auth/bootstrap (garde client/gérant). */
  role?: 'client' | 'gerant';
  /** POST /admin/login répond 401 au lieu de délivrer un jeton. */
  adminLoginFails?: boolean;
  /** GET /admin/me répond 401 (jeton expiré). */
  adminMeUnauthorized?: boolean;
}

async function respond(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockApi(page: Page, options: MockApiOptions = {}): Promise<void> {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = route.request().method();

    const marketParam = url.searchParams.get('market');
    const rooms = options.rooms ?? (marketParam === 'BJ' ? bjRooms : ciRooms);
    const categories =
      options.categories ?? (marketParam === 'BJ' ? bjCategories : ciCategories);

    if (method === 'POST') {
      if (path === '/reservations') {
        return respond(route, { id: 'res-1', statut: 'en_attente' }, 201);
      }
      if (path === '/auth/bootstrap') {
        return respond(route, { role: options.role ?? null, client: null, gerant: null });
      }
      if (path === '/upload') {
        return respond(route, { url: '/images/upload-e2e.jpg' }, 201);
      }
      if (path === '/newsletter') {
        return respond(route, { message: 'Inscription enregistrée' }, 201);
      }
      if (path === '/admin/login') {
        if (options.adminLoginFails) {
          return respond(route, { error: 'Identifiants invalides' }, 401);
        }
        return respond(route, { token: 'e2e-admin-token', admin: adminMeResponse });
      }
      if (path === '/admin/change-password') {
        return respond(route, { message: 'Mot de passe modifié avec succès' });
      }
      return respond(route, {});
    }

    if (method !== 'GET') {
      return respond(route, {});
    }

    // /rooms/villes doit être testé avant le préfixe /rooms/:id.
    if (path === '/rooms/villes') {
      return respond(route, [...new Set(rooms.map((r) => String(r.ville)))].sort());
    }
    if (path === '/reviews') return respond(route, reviewsResponse);
    if (path === '/reviews/featured') return respond(route, []);
    if (path === '/reviews/mine') return respond(route, []);
    if (path === '/rooms/popular') return respond(route, rooms);
    if (path === '/rooms/available') return respond(route, rooms);
    if (path === '/rooms/mine') return respond(route, []);
    if (path === '/rooms') return respond(route, rooms);
    if (path.startsWith('/rooms/')) {
      const id = decodeURIComponent(path.slice('/rooms/'.length));
      const room = rooms.find((r) => r.id === id);
      return respond(route, room ?? {}, room ? 200 : 404);
    }
    if (path === '/categories') return respond(route, categories);
    if (path === '/banners') return respond(route, []);
    if (path === '/events') return respond(route, []);
    if (path === '/reservations/mine' || path === '/reservations/client') {
      return respond(route, []);
    }
    if (path === '/reservations/check') {
      return respond(route, { disponible: true });
    }
    if (path.startsWith('/notifications')) return respond(route, []);
    if (path === '/auth/me') {
      return respond(route, { role: null, client: null, gerant: null });
    }
    if (path === '/clients/me' || path === '/gerants/me') {
      return respond(route, {});
    }
    if (path === '/gerants/verification-status') {
      return respond(route, { status: 'none' });
    }

    // Back-office admin (aucun Clerk : jeton localStorage + Bearer).
    if (path === '/admin/me') {
      if (options.adminMeUnauthorized) return respond(route, { error: 'Jeton invalide' }, 401);
      return respond(route, adminMeResponse);
    }
    if (path === '/admin/stats') return respond(route, adminStatsResponse);
    if (path === '/admin/notifications') {
      return respond(route, { notifications: [], unread_count: 0 });
    }
    if (path === '/admin/gerants' || path === '/admin/reservations') {
      return respond(route, []);
    }

    return respond(route, {});
  });
}

/**
 * Pose le jeton admin avant le premier chargement de la page : `adminApi.ts`
 * lit `localStorage['admin_token']` au chargement du module.
 */
export async function loginAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('admin_token', 'e2e-admin-token');
  });
}
