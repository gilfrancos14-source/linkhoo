/* Serveur autonome des tests hors-ligne (Phase B).
   - Sert le build `dist/` avec repli SPA : toute route inconnue renvoie
     index.html, comme le fait `vite preview`.
   - Répond aux endpoints publics `/api/*` avec un jeu de données miroir
     de `e2e/fixtures.ts`. Indispensable : les requêtes émises par le
     service worker ne sont pas interceptables par `page.route()`, donc un
     mock côté Playwright serait ignoré une fois le SW actif.
   - Aucune dépendance au backend, aux secrets Supabase ou à Clerk.
   Ce fichier n'est jamais importé par l'application ; il n'est lancé que
   par `playwright.offline.config.ts` (script `test:e2e:offline`). */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4173;
const HOST = '127.0.0.1';
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/* ---------------------------------------------------------------- fixtures
   Miroir volontaire de `e2e/fixtures.ts` (marché CI uniquement : les specs
   offline n'ouvrent que /ci). En cas d'évolution de forme de réponse,
   mettre les deux fichiers à jour ensemble. */

function makeRoom(overrides = {}) {
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
    pays: 'Côte d’Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    date_dispo: '2026-10-01',
    conditions: 'Annulation gratuite 48 h avant l’arrivée',
    is_popular: true,
    ...overrides,
  };
}

const rooms = [
  makeRoom({ id: 'rm-1', title: 'Studio Cocody Riviera' }),
  makeRoom({
    id: 'rm-2',
    title: 'Appartement Plateau Vue Mer',
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

const categories = [
  { id: 'ci-chambres-moins-cheres', title: 'Chambres moins chères', market: 'CI' },
  { id: 'ci-appartements', title: 'Appartements', market: 'CI' },
];

const tourism = {
  big: [
    {
      id: 'des-ci-abidjan',
      title: 'Abidjan',
      city: 'Abidjan',
      description: 'Le Plateau, Cocody et la lagune Ébrié.',
      img: '/images/pexels-artbovich-7214173.jpg',
      alt: 'Abidjan vue depuis la ville',
      featured: false,
    },
    {
      id: 'des-ci-bouake',
      title: 'Bouaké',
      city: 'Bouaké',
      description: 'Deuxième ville du pays, capitale des masques.',
      img: '/images/pexels-artbovich-6782567.jpg',
      alt: 'Grand marché de Bouaké',
      featured: false,
    },
  ],
  small: [
    {
      id: 'des-ci-grand-bassam',
      title: 'Grand-Bassam',
      city: 'Grand-Bassam',
      description: 'Première capitale du pays, classée à l’UNESCO.',
      img: '/images/pexels-fotoaibe-1571460.jpg',
      alt: 'Plage de Grand-Bassam',
      featured: false,
    },
  ],
};

const reviewsResponse = {
  reviews: [],
  room_avg: 4.5,
  room_count: 12,
  gerant_avg: 4.7,
  gerant_count: 8,
};

/* --------------------------------------------------------------- API mock */

function apiResponse(pathname, searchParams, method) {
  const p = pathname.replace(/^\/api/, '');

  if (method === 'POST') {
    if (p === '/newsletter') return [201, { message: 'Inscription enregistrée' }];
    if (p === '/reservations') return [201, { id: 'res-1', statut: 'en_attente' }];
    if (p === '/auth/bootstrap') return [200, { role: null, client: null, gerant: null }];
    return [200, {}];
  }

  if (method !== 'GET') return [200, {}];

  if (p === '/rooms/villes') return [200, ['Abidjan', 'Bouaké']];
  if (p === '/rooms/popular') return [200, rooms];
  if (p === '/rooms/available') return [200, rooms];
  if (p === '/rooms/mine') return [200, []];
  if (p === '/rooms') return [200, rooms];
  if (p.startsWith('/rooms/')) {
    const id = decodeURIComponent(p.slice('/rooms/'.length));
    const room = rooms.find((r) => r.id === id);
    return room ? [200, room] : [404, { error: 'Chambre introuvable' }];
  }
  if (p === '/categories') return [200, categories];
  if (p === '/banners') return [200, []];
  if (p === '/events') return [200, []];
  if (p === '/tourism') return [200, tourism];
  if (p === '/reviews/featured') return [200, []];
  if (p === '/reviews') return [200, reviewsResponse];
  if (p.startsWith('/notifications')) return [200, []];
  if (p === '/reservations/check') return [200, { disponible: true }];
  if (p === '/reservations/mine' || p === '/reservations/client') return [200, []];
  if (p === '/auth/me') return [200, { role: null, client: null, gerant: null }];
  if (p === '/clients/me' || p === '/gerants/me') return [200, {}];
  if (p === '/gerants/verification-status') return [200, { status: 'none' }];
  // Tout autre GET public renvoie un objet vide (miroir de fixtures.ts).
  return [200, {}];
}

/* --------------------------------------------------------------- statiques */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

async function staticFile(pathname) {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(DIST, safe);
  if (!file.startsWith(DIST)) return null;
  try {
    const data = await readFile(file);
    return { data, type: MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const { pathname } = url;
  const method = req.method ?? 'GET';

  // API publique + toute autre route POST : réponse JSON.
  if (pathname.startsWith('/api/')) {
    const [status, body] = apiResponse(pathname, url.searchParams, method);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end();
    return;
  }

  const file = await staticFile(pathname);
  if (file) {
    res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-cache' });
    res.end(file.data);
    return;
  }

  // Repli SPA : les routes React (/ci, /ci/chambre/rm-1…) servent index.html.
  const index = await staticFile('/index.html');
  res.writeHead(index ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(index ? index.data : 'dist/ introuvable : lancez `npm run build`.');
});

server.listen(PORT, HOST, () => {
  // Silencieux : Playwright lit la sortie de ses webServers.
});
