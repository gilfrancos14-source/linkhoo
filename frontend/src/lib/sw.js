// Service Worker — version 4 (durcie)
//
// Règles de sécurité :
//   1. JAMAIS de cache ni de file d'attente pour une requête authentifiée
//      (Authorization / cookie) : la clé du Cache API est l'URL, pas l'en-tête,
//      ce qui renverrait les données d'un utilisateur à un autre sur le même
//      navigateur.
//   2. JAMAIS de requête de paiement interceptée : le retour HTTP doit rester
//      fidèle au serveur (un 409 ne doit jamais devenir un 202 « queued »).
//   3. Seuls les GET explicitement marqués publics (X-Public-Api: 1, posé par
//      api.ts quand `public: true`) peuvent être mis en cache.

const STATIC_CACHE = 'ilehya-static-v4';
const DYNAMIC_CACHE = 'ilehya-dynamic-v4';
const IMAGE_CACHE = 'ilehya-images-v4';
const KEEP_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];

// Uniquement des fichiers RÉELS du build. Vite compile tous les CSS/JS dans
// /assets/ avec des noms hashés : l'ancienne liste (/css/*.css) pointait sur
// des fichiers inexistants, faisait échouer cache.addAll() et empêchait
// l'installation du service worker (donc tout le mode hors ligne).
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

// Requêtes de NAVIGATION (pages SPA) : on tente le réseau, puis on retombe
// sur l'index.html en cache pour que les pages déjà visitées s'affichent
// hors ligne. Les données personnelles ne sont PAS concernées (voir
// bypassesServiceWorker : les requêtes authentifiées ne sont pas interceptées).
function isNavigation(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Ces chemins ne sont jamais interceptés, même sans en-tête d'authentification.
const NEVER_INTERCEPT = [
  /\/api\/auth\//,
  // Détection de marché : dépend de l'IP du visiteur. Une réponse mise en
  // cache sous l'URL serait resservie à un autre appareil / après un voyage.
  /\/api\/discover\/market(?:\/|$)/,
  /\/api\/reservations\/payment\/confirm(?:\/|$)/,
  /\/api\/reservations\/[^/]+\/payment(?:\/|$)/,
  /\/api\/premium\/(?:initiate|confirm)(?:\/|$)/,
  /\/api\/payments(?:\/|$)/,
];

function bypassesServiceWorker(request) {
  if (request.headers.has('authorization') || request.headers.has('cookie')) {
    return true;
  }
  try {
    const { pathname } = new URL(request.url);
    return NEVER_INTERCEPT.some((pattern) => pattern.test(pathname));
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.clients.claim()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => !KEEP_CACHES.includes(name)).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request.url.startsWith('http')) return;
  if (bypassesServiceWorker(request)) return;

  const url = new URL(request.url);

  // Navigation SPA : réseau d'abord, fallback index.html en cache hors ligne.
  if (isNavigation(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  if (url.pathname.includes('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  event.respondWith(handleNormalRequest(request));
});

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error(`Image indisponible: ${response.status}`);
    cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f0f0f0"/></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } },
    );
  }
}

async function handleApiRequest(request) {
  // Écritures : toujours le réseau, jamais de file d'attente, jamais de
  // réponse synthétique. Les erreurs 4xx/5xx sont transmises telles quelles.
  if (request.method !== 'GET') return fetch(request);

  // Un GET n'est mis en cache que s'il est explicitement public.
  if (request.headers.get('x-public-api') !== '1') return fetch(request);

  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Service indisponible', message: 'Vérifiez votre connexion', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      // On stocke l'index sous une clé commune : toute navigation hors ligne
      // retombera dessus, quelle que soit la route (/ci/chambre/... etc.).
      cache.put('/index.html', response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = (await cache.match('/index.html')) || (await caches.match('/index.html'));
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html><head><title>Mode hors-ligne</title></head><body><div style="text-align:center;padding:50px"><h1>Mode hors-ligne</h1><p>Vérifiez votre connexion puis réessayez.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } },
    );
  }
}

async function handleNormalRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      dynamicCache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const fallback = await dynamicCache.match(request);
    if (fallback) return fallback;
    return new Response(
      '<!DOCTYPE html><html><head><title>Mode hors-ligne</title></head><body><div style="text-align:center;padding:50px"><h1>Mode hors-ligne</h1><p>Vérifiez votre connexion puis réessayez.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } },
    );
  }
}

async function clearSensitiveData(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
    return;
  }
  const names = await caches.keys();
  await Promise.all(names.filter((name) => !KEEP_CACHES.includes(name)).map((name) => caches.delete(name)));
  // DYNAMIC_CACHE contient les GET publics : on le vide aussi à la déconnexion.
  await caches.delete(DYNAMIC_CACHE);
}

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  if (type === 'CLEAR_CACHE') void clearSensitiveData(data?.cacheName);
  if (type === 'SHOW_NOTIFICATION') void showNotification(data || {});
});

self.addEventListener('push', (event) => {
  if (!event.data) return void showNotification({ title: 'Notification' });
  try {
    showNotification(event.data.json());
  } catch {
    showNotification({ title: 'Notification' });
  }
});

async function showNotification(data) {
  try {
    const options = {
      body: data.body || 'Une nouveauté vous attend sur Ileyha.',
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'general',
      data: data.data || {},
      actions: data.actions || [],
      silent: data.silent || false,
      requireInteraction: data.requireInteraction || false,
    };
    await self.registration.showNotification(data.title || 'Notification', options);
  } catch (error) {
    console.error('[sw] notification impossible', error);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url;
  if (target) event.waitUntil(self.clients.openWindow(target));
});
