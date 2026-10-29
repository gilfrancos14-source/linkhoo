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

/** Message de messagerie (forme `Message` de `lib/api.ts`). */
export function makeMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_role: 'client',
    body: 'Bonjour',
    read_at: null,
    created_at: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Conversation de messagerie (forme `Conversation` de `lib/api.ts`). */
export function makeConversation(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'conv-1',
    room_id: 'rm-1',
    client_id: 'client-1',
    gerant_id: 'gerant-1',
    client_name: 'Awa Koné',
    client_email: 'awa@example.ci',
    last_message_at: '2026-10-01T10:00:00.000Z',
    created_at: '2026-10-01T09:00:00.000Z',
    room: { id: 'rm-1', title: 'Studio Cocody Riviera', img: null, market: 'CI' },
    last_message: null,
    unread_count: 0,
    ...overrides,
  };
}

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
  // Toutes les sections du back-office : sans ces permissions la sidebar
  // n'affiche que « Mot de passe » (cf. `SuperAdminLayout.can()`).
  permissions: [
    'stats',
    'reservations',
    'gerants',
    'bannieres',
    'evenements',
    'destinations',
    'escapades',
    'promotions',
  ],
};

const adminStatsResponse = {
  gerants: {
    total: 4,
    verified: 2,
    pendingVerifications: 1,
    premium: 1,
    byMarket: { CI: 2, BJ: 1, SN: 1, TG: 0, CM: 0, BF: 0, CG: 0, GA: 0, GN: 0, ML: 0, NE: 0, CD: 0 },
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
  /** Bannières servies par GET /banners (filtrées par marché et section). */
  banners?: Record<string, unknown>[];
  /** Rôle renvoyé par POST /auth/bootstrap (garde client/gérant). */
  role?: 'client' | 'gerant';
  /** POST /admin/login répond 401 au lieu de délivrer un jeton. */
  adminLoginFails?: boolean;
  /** GET /admin/me répond 401 (jeton expiré). */
  adminMeUnauthorized?: boolean;
  /** Nombre de messages non lus du client (GET /messages/unread). */
  unreadCount?: number;
  /** Nombre de messages non lus du gérant (GET /messages/gerant/unread). */
  gerantUnreadCount?: number;
  /** Conversations servies par les boîtes de réception. */
  conversations?: Record<string, unknown>[];
  /** Messages servis par GET /messages/conversations/:id/messages. */
  messages?: Record<string, unknown>[];
  /** Profil gérant servi par GET /gerants/me (suivi de vérification). */
  gerant?: Record<string, unknown>;
  /** Dossier servi par GET /gerants/:id/verification-status. */
  verification?: Record<string, unknown>;
}

async function respond(
  route: Route,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  });
}

/** Cookie HttpOnly posé par le serveur au login admin (cf. `adminApi.ts`). */
const ADMIN_COOKIE = 'admin_token=e2e-admin-token; Path=/; HttpOnly; SameSite=Lax';
const ADMIN_COOKIE_EXPIRED = 'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

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
        // Le jeton vit dans un cookie HttpOnly : aucun secret lisible en JS.
        return respond(
          route,
          { admin: adminMeResponse },
          200,
          { 'set-cookie': ADMIN_COOKIE },
        );
      }
      if (path === '/admin/logout') {
        return respond(route, { ok: true }, 200, { 'set-cookie': ADMIN_COOKIE_EXPIRED });
      }
      if (path === '/admin/change-password') {
        return respond(route, { message: 'Mot de passe modifié avec succès' });
      }
      // Messagerie : envoi de message, marquage lu, création de conversation.
      if (path.startsWith('/messages/conversations/') && path.endsWith('/messages')) {
        const payload = (route.request().postDataJSON() ?? {}) as { body?: string };
        const conversationId = path.split('/')[3] ?? 'conv-1';
        return respond(
          route,
          makeMessage({
            id: `msg-sent-${Date.now()}`,
            conversation_id: conversationId,
            sender_role: options.role === 'gerant' ? 'gerant' : 'client',
            body: payload.body ?? '',
            created_at: new Date().toISOString(),
          }),
          201,
        );
      }
      if (path.startsWith('/messages/conversations/') && path.endsWith('/read')) {
        return respond(route, { updated: 0 });
      }
      if (path === '/messages/conversations') {
        return respond(route, (options.conversations ?? [])[0] ?? makeConversation(), 201);
      }
      return respond(route, {});
    }

    if (method !== 'GET') {
      return respond(route, {});
    }

    // /rooms/villes et /rooms/quartiers doivent être testés avant le préfixe /rooms/:id.
    if (path === '/rooms/villes') {
      return respond(route, [...new Set(rooms.map((r) => String(r.ville)))].sort());
    }
    if (path === '/rooms/quartiers') {
      return respond(route, [...new Set(rooms.map((r) => String(r.quartier)))].sort());
    }
    if (path === '/reviews') return respond(route, reviewsResponse);
    if (path === '/reviews/featured') return respond(route, []);
    if (path === '/reviews/mine') return respond(route, []);
    if (path === '/rooms/popular') return respond(route, rooms);
    if (path === '/rooms/available') return respond(route, rooms);
    if (path === '/rooms/mine') return respond(route, []);
    if (path === '/rooms') {
      // Même périmètre que le backend : filtres appliqués ici, puis
      // pagination ({items,total,page,limit}) si page/limit sont demandés.
      let filtered = rooms;
      const category = url.searchParams.get('category');
      const ville = url.searchParams.get('ville');
      const quartier = url.searchParams.get('quartier');
      const chambres = url.searchParams.get('chambres');
      const disponible = url.searchParams.get('disponible');
      if (category) filtered = filtered.filter((r) => r.category === category);
      if (ville) filtered = filtered.filter((r) => r.ville === ville);
      if (quartier) filtered = filtered.filter((r) => r.quartier === quartier);
      if (chambres) {
        const wanted = Number(chambres);
        filtered = filtered.filter((r) =>
          wanted >= 3 ? Number(r.chambres) >= 3 : Number(r.chambres) === wanted,
        );
      }
      if (disponible !== null) {
        filtered = filtered.filter((r) => String(r.disponible) === disponible);
      }

      const pageParam = url.searchParams.get('page');
      const limitParam = url.searchParams.get('limit');
      if (pageParam || limitParam) {
        const page = Number(pageParam ?? '1');
        const limit = Number(limitParam ?? '10');
        const start = (page - 1) * limit;
        return respond(route, {
          items: filtered.slice(start, start + limit),
          total: filtered.length,
          page,
          limit,
        });
      }
      return respond(route, filtered);
    }
    if (path.startsWith('/rooms/')) {
      const id = decodeURIComponent(path.slice('/rooms/'.length));
      const room = rooms.find((r) => r.id === id);
      return respond(route, room ?? {}, room ? 200 : 404);
    }
    if (path === '/categories') return respond(route, categories);
    if (path === '/banners') {
      const section = url.searchParams.get('section');
      const banners = (options.banners ?? []).filter(
        (banner) =>
          (!marketParam || banner.market === marketParam) &&
          (!section || banner.section === section),
      );
      return respond(route, banners);
    }
    if (path === '/events') return respond(route, []);
    if (path === '/reservations/mine' || path === '/reservations/client') {
      return respond(route, []);
    }
    if (path === '/reservations/check') {
      return respond(route, { disponible: true });
    }
    if (path.startsWith('/notifications')) return respond(route, []);
    // Messagerie : compteurs de non-lus et boîtes de réception.
    if (path === '/messages/unread') return respond(route, { count: options.unreadCount ?? 0 });
    if (path === '/messages/gerant/unread') {
      return respond(route, { count: options.gerantUnreadCount ?? 0 });
    }
    if (path === '/messages/conversations' || path === '/messages/gerant/conversations') {
      const items = options.conversations ?? [];
      return respond(route, { items, total: items.length, page: 1, limit: 20 });
    }
    if (path.startsWith('/messages/conversations/')) {
      const rest = path.slice('/messages/conversations/'.length);
      if (rest.endsWith('/messages')) return respond(route, options.messages ?? []);
      const id = decodeURIComponent(rest);
      const conversation = (options.conversations ?? []).find((c) => c.id === id);
      return respond(route, conversation ?? {}, conversation ? 200 : 404);
    }
    if (path === '/auth/me') {
      return respond(route, { role: null, client: null, gerant: null });
    }
    if (path === '/clients/me') {
      return respond(route, {});
    }
    if (path === '/gerants/me') {
      return respond(route, options.gerant ?? {});
    }
    // Dossier de vérification du gérant connecté (page de suivi).
    if (/^\/gerants\/[^/]+\/verification-status$/.test(path)) {
      return respond(route, options.verification ?? {});
    }
    if (path === '/gerants/verification-status') {
      return respond(route, { status: 'none' });
    }

    // Back-office admin : session = cookie HttpOnly, comme en production.
    // Sans cookie (ou cookie refusé), /admin/me répond 401 et le guard redirige.
    if (path === '/admin/me') {
      const cookie = route.request().headers()['cookie'] ?? '';
      if (options.adminMeUnauthorized || !cookie.includes('admin_token=')) {
        return respond(route, { error: 'Jeton invalide' }, 401);
      }
      return respond(route, adminMeResponse);
    }
    if (path === '/admin/stats') return respond(route, adminStatsResponse);
    if (path === '/admin/notifications') {
      return respond(route, { notifications: [], unread_count: 0 });
    }
    if (path === '/admin/gerants') {
      return respond(route, []);
    }
    // Réponse paginée de GET /admin/reservations (items + total + counts).
    if (path === '/admin/reservations') {
      const page = Number(url.searchParams.get('page') ?? '1');
      const limit = Number(url.searchParams.get('limit') ?? '20');
      return respond(route, {
        items: [],
        total: 0,
        page,
        limit,
        counts: { total: 0, pending: 0, confirmed: 0, cancelled: 0 },
      });
    }

    return respond(route, {});
  });
}

/**
 * Pose la session admin avant le premier chargement de la page : cookie
 * HttpOnly simulé + indice `admin_session` (ce que fait `setAdminToken()`).
 */
export async function loginAdmin(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: 'admin_token', value: 'e2e-admin-token', url: 'http://127.0.0.1:5173' },
  ]);
  await page.addInitScript(() => {
    window.sessionStorage.setItem('admin_session', '1');
  });
}
