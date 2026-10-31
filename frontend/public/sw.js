const CACHE_NAME = 'linkhoo-v1';
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/css/41-client-dashboard.css',
  '/css/42-client-reservations.css',
  '/css/43-client-messages.css',
  '/css/40-room-detail-maq7.css',
  '/css/00-fontawesome.css',
  '/css/01-tokens.css',
  '/css/02-base.css',
  '/css/03-header.css',
  '/css/10-home-avis-footer.css',
  '/css/11-responsive-global.css',
  '/css/28-landing-accueil.css',
  '/css/31-maquette.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    }).then(() => {
      // Forcer le contrôle actif immédiatement
      return self.clients.claim();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  // S'assurer que le SW est actif immédiatement
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes non-GET ou les requêtes API websocket/etc
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Stratégie : réseau d'abord, fallback cache
  // Pour les routes API et données, essayer le réseau en premier
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/messages/') || url.pathname.startsWith('/rooms/')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Mise en cache réussie : reproduire la réponse pour les prochaines fois
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          try {
            cache.put(event.request, cloned);
          } catch (e) {
            // Cache plein ou erreur — non bloquant
          }
        });
        return response;
      }).catch(() => {
        // Hors-ligne : essayer le cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Pour la page d'accueil hors-ligne : retourner la racine
          if (event.request.url === self.location.origin) {
            return caches.match('/');
          }
          return null;
        });
      })
    );
    return;
  }

  // Pour les ressources statiques (CSS, JS, images, fonts) : cache-first
  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/') || url.pathname.match(\\.(png|jpg|jpeg|svg|webp|ico|ttf|woff|woff2)$)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(event.request, cloned);
            } catch (e) {}
          });
          return response;
        }).catch(() => cached || offlineFallback(event.request));
      })
    );
    return;
  }

  // Pour les navigations (HTML) : réseau d'abord, fallback cache
  event.respondWith(
    fetch(event.request).then((response) => {
      const cloned = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        try {
          cache.put(event.request, cloned);
        } catch (e) {}
      });
      return response;
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // Page offline personnalisée
        return new Response(
          '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<title>Linkhoo — Hors-ligne</title>\n<link rel="manifest" href="/manifest.json">\n<style>\n  body {font-family: system-ui, sans-serif; padding: 40px; background: #f8faff; color: #0b1b3f;}\n  .container {max-width: 600px; margin: 0 auto;}\n  .offline {color: #ff5a14;}\n  a {color: #2f5bbf;}\n</style>\n</head>\n<body>\n<div class="container">\n<h1 class="offline">Hors-ligne</h1>\n<p>Vous êtes connecté en mode hors-ligne.<br/> Certaines fonctionnalités peuvent être limitées.</p>\n<p>Rechargez la page lorsque vous aurez de nouveau accès à Internet.</p>\n<div>\n<a href="/">Retour à l’accueil</a>\n</div>\n</div>\n</body>\n</html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      });
    })
  );
});

/**
 * Retourne une page de fallback hors-ligne pour une ressource donnée.
 */
function offlineFallback(request) {
  return new Response(
    '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<title>Linkhoo — Hors-ligne</title>\n<link rel="manifest" href="/manifest.json">\n<style>\n  body {font-family: system-ui, sans-serif; padding: 40px; background: #f8faff; color: #0b1b3f;}\n  .container {max-width: 600px; margin: 0 auto;}\n  .offline {color: #ff5a14;}\n  a {color: #2f5bbf;}\n</style>\n</head>\n<body>\n<div class="container">\n<h1 class="offline">Hors-ligne</h1>\n<p>Vous êtes connecté en mode hors-ligne.<br/> Certaines fonctionnalités peuvent être limitées.</p>\n<p>Rechargez la page lorsque vous aurez de nouveau accès à Internet.</p>\n<div>\n<a href="/">Retour à l’accueil</a>\n</div>\n</div>\n</body>\n</html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}