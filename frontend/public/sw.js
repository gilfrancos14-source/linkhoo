/* Linkhoo — service worker.
   Objectif : la consultation publique (accueil, catégories, chambres) doit
   fonctionner sans connexion, à partir de la dernière visite.
   Règles d'or :
   - Jamais de cache sur une requête portant un en-tête Authorization.
   - Jamais de cache sur les espaces privés (admin, gérant, réservations,
     documents de vérification à URL signée).
   - Les naviguations passent par le réseau d'abord : un déploiement n'est
     jamais figé pour un utilisateur en ligne.
   - Pas de skipWaiting automatique : la nouvelle version prend le relais
     à la fermeture des onglets, pour ne jamais supprimer les assets
     qu'un onglet en cours a encore à charger. */

'use strict';

const SW_VERSION = 'v1';
const CACHE_PREFIX = 'linkhoo-';
const PRECACHE = `${CACHE_PREFIX}precache-${SW_VERSION}`;
const PAGES = `${CACHE_PREFIX}pages-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}api-${SW_VERSION}`;
const IMG_CACHE = `${CACHE_PREFIX}img-${SW_VERSION}`;
const KEEP = [PRECACHE, PAGES, API_CACHE, IMG_CACHE];

const NAV_TIMEOUT_MS = 3000;
const IMG_CACHE_MAX = 60;

/* Contenu statique du seed : images, polices, icônes, manifest.
   Les assets hashés de Vite (/assets/*) sont mis en cache à la première
   vue — leur nom de fichier change à chaque build. */
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/fonts/lato-1.woff2',
  '/fonts/lato-2.woff2',
  '/fonts/lato-3.woff2',
  '/fonts/lato-4.woff2',
  '/fonts/lato-5.woff2',
  '/fonts/lato-6.woff2',
  '/fonts/lato-7.woff2',
  '/fonts/lato-8.woff2',
  '/fonts/lato-9.woff2',
  '/fonts/lato-10.woff2',
  '/images/1.jpg',
  '/images/4.jpg',
  '/images/ouidah.jpg',
  '/images/tori.jpg',
  '/images/pexels-artbovich-5998117.jpg',
  '/images/pexels-artbovich-5998120.jpg',
  '/images/pexels-artbovich-6238608.jpg',
  '/images/pexels-artbovich-6283961.jpg',
  '/images/pexels-artbovich-6315808.jpg',
  '/images/pexels-artbovich-6758771.jpg',
  '/images/pexels-artbovich-6782567.jpg',
  '/images/pexels-artbovich-7045712.jpg',
  '/images/pexels-artbovich-7214173.jpg',
  '/images/pexels-donaldtong94-189333.jpg',
  '/images/pexels-fotoaibe-1571460.jpg',
];

/* Allowlist des GET publics à conserver hors-ligne.
   Tout le reste (recherche, disponibilité, auth, notifications, premium,
   upload, newsletter) n'est jamais mis en cache. */
const API_ALLOWLIST = [
  '/api/banners',
  '/api/categories',
  '/api/events',
  '/api/tourism',
  '/api/reviews/featured',
  '/api/rooms/popular',
  '/api/rooms',
];

/* ---------------------------------------------------------------- helpers */

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isCacheableApi(url, request) {
  if (request.method !== 'GET') return false;
  // Requête authentifiée : on ne touche pas (données privées).
  if (request.headers.get('Authorization')) return false;
  if (url.origin !== self.location.origin) return false;
  if (API_ALLOWLIST.includes(url.pathname)) return true;
  // Fiche d'une chambre : /api/rooms/<id> (jamais les sous-routes privées).
  if (/^\/api\/rooms\/[^/]+$/.test(url.pathname)) {
    const last = url.pathname.split('/').pop();
    return !['mine', 'available', 'villes', 'popular'].includes(last);
  }
  return false;
}

function isCacheableImage(url) {
  // Images du seed (same-origin)…
  if (url.origin === self.location.origin && url.pathname.startsWith('/images/')) return true;
  // …images uploadées sur le bucket public « images » de Supabase Storage.
  // Le pattern exclut « verification-docs » (privé, URL signée 1 h).
  return (
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/storage/v1/object/public/images/')
  );
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/* ------------------------------------------------------------- strategies */

/* Navigations : réseau d'abord (3 s), le cache sert de repli hors-ligne.
   La page HTML n'est donc jamais « gelée » après un déploiement. */
async function handleNavigation(request) {
  try {
    const res = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
    if (res && res.ok) {
      const cache = await caches.open(PAGES);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached =
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match('/'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Hors-ligne</title>' +
        '<body style="font-family:sans-serif;padding:3rem;text-align:center">' +
        '<h1>Vous êtes hors-ligne</h1><p>Cette page n\'a pas encore été visitée avec une connexion.</p>' +
        '<p><a href="/">Retour à l\'accueil</a></p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/* Assets hashés et fichiers statiques : cache d'abord (immutables). */
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) {
    const cache = await caches.open(PRECACHE);
    cache.put(request, res.clone());
  }
  return res;
}

/* API publique : stale-while-revalidate — on sert immédiatement ce qu'on a,
   puis on revalide en arrière-plan. Hors-ligne : la dernière réponse connue. */
async function handleApi(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const revalidate = fetch(request)
    .then(async (res) => {
      if (res && res.ok) await cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    void revalidate;
    return cached;
  }
  const res = await revalidate;
  if (res) return res;
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* Images : cache d'abord (tous les caches : le precache du seed est
   consulté en premier), plafonné pour ne pas déborder du quota. */
async function handleImage(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(IMG_CACHE);
  const res = await fetch(request);
  if (res && res.ok) {
    await cache.put(request, res.clone());
    await trimCache(IMG_CACHE, IMG_CACHE_MAX);
  }
  return res;
}

/* -------------------------------------------------------------- lifecycle */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      // Un fichier manquant ne doit pas empêcher l'installation du SW :
      // on précharge ce qui existe, on signale le reste.
      Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !KEEP.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Requêtes authentifiées : comportement natif, jamais interceptées.
  if (request.headers.get('Authorization')) return;

  // Images (seed same-origin + bucket public « images » de Supabase) :
  // cache dédié, plafonné. verification-docs est exclu par isCacheableImage.
  if (isCacheableImage(url)) {
    event.respondWith(handleImage(request));
    return;
  }

  // Autres origines (Clerk, tuiles, etc.) : comportement natif.
  if (url.origin !== self.location.origin) return;

  if (isCacheableApi(url, request)) {
    event.respondWith(handleApi(request));
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.jpg' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(handleAsset(request));
  }
});
