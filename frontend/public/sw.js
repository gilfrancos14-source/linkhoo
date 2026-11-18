// Service Worker avancé pour l'application Ileyha Location - Phase 2 PWA
// Version 2.0 - Comprend notifications push, synchronisation hors-ligne, formulaires hors-ligne, optimisation d'images, gestion avancée du cache

// Configuration des noms de cache
const STATIC_CACHE = 'ilehya-static-v3';
const DYNAMIC_CACHE = 'ilehya-dynamic-v3';
const IMAGE_CACHE = 'ilehya-images-v3';
const OFFLINE_QUEUE_CACHE = 'ilehya-offline-queue-v3';

// Liste des fichiers à pré-cacher statiquement
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

// Liste des URL à ne jamais mettre en cache
const NEVER_CACHE = [
  /\/api\/auth\/login/,
  /\/api\/auth\/register/,
  /\/api\/auth\/logout/,
  /\/admin\/login/,
  /\/admin\/dashboard/,
];

// Gestionnaire d'installation
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE);
    }).then(() => {
      // Forcer le contrôle actif immédiatement
      return self.clients.claim();
    }).catch((error) => {
      console.error('Erreur lors de l\'installation du service worker:', error);
    })
  );
});

// Gestionnaire d'activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation');
  
  event.waitUntil(
    // Nettoyer les anciens caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== IMAGE_CACHE &&
              cacheName !== OFFLINE_QUEUE_CACHE) {
            console.log('Suppression du cache obsolète:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Forcer le contrôle actif immédiatement
      return self.clients.claim();
    })
  );
});

// Gestionnaire de fetch avec stratégie avancée
self.addEventListener('fetch', (event) => {
  const { url } = event.request;
  
  // Ignorer les requêtes non-HTTP
  if (!url.startsWith('http')) {
    return;
  }
  
  // Ne jamais mettre en cache les URL spécifiques
  if (NEVER_CACHE.some(pattern => pattern.test(url))) {
    return;
  }
  
  // Stratégie pour les images
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(handleImageRequest(event.request));
    return;
  }
  
  // Stratégie pour les requêtes API
  if (url.includes('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Stratégie pour les requêtes normales
  event.respondWith(handleNormalRequest(event.request));
});

// Gestionnaire de requêtes d'images : cache-first, réseau en secours.
// (L'optimisation canvas n'est pas possible dans un Service Worker : les API
// DOM `Image`/`document`/`URL.createObjectURL` n'y existent pas.)
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (!networkResponse.ok) {
      throw new Error(`Réseau non disponible: ${networkResponse.status}`);
    }

    // Le clone est mis en cache : le corps de la réponse d'origine reste
    // intact pour le rendu, sinon l'image s'affiche cassée.
    cache.put(request, networkResponse.clone()).catch(() => {});

    return networkResponse;
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);

    const cachedFallback = await cache.match(request);
    if (cachedFallback) {
      return cachedFallback;
    }

    // Retourner une image de remplacement
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f0f0f0"/><text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="20" fill="#666">Image indisponible</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// Gestionnaire de requêtes API avec file d'attente hors-ligne
async function handleApiRequest(request) {
  // Vérifier si la requête est une tentative de synchronisation
  if (request.method === 'GET') {
    // Pour les requêtes GET, essayer le cache d'abord, puis le réseau
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Mettre à jour le cache en arrière-plan
      fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
      });
      
      return cachedResponse;
    }
    
    // Si pas en cache, essayer le réseau
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // Mettre en cache la réponse
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);
        
        return networkResponse;
      } else {
        throw new Error(`Réseau non disponible: ${networkResponse.status}`);
      }
    } catch (error) {
      console.error('Erreur lors de la requête API:', error);
      
      // Si la requête échoue, retourner une réponse d'erreur
      return new Response(
        JSON.stringify({ 
          error: 'Service indisponible', 
          message: 'Vérifiez votre connexion et réessayez',
          offline: true 
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } else {
    // Pour les requêtes POST/PUT/DELETE, utiliser la file d'attente hors-ligne
    return handleOfflineRequest(request);
  }
}

// Gestionnaire de requêtes normales
async function handleNormalRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Mettre à jour le cache en arrière-plan pour les ressources statiques
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
    });
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Mettre en cache les réponses dynamiques
      const responseClone = networkResponse.clone();
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      await dynamicCache.put(request, responseClone);
      
      return networkResponse;
    } else {
      throw new Error(`Réseau non disponible: ${networkResponse.status}`);
    }
  } catch (error) {
    console.error('Erreur lors de la requête normale:', error);
    
    // Si la requête échoue, essayer le cache dynamique
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await dynamicCache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si rien n'est disponible, retourner une page hors-ligne
    return new Response(
      '<!DOCTYPE html><html><head><title>Mode hors-ligne</title></head><body><div style="text-align: center; padding: 50px;"><h1>Mode hors-ligne</h1><p>Vous êtes actuellement déconnecté. Veuillez vérifier votre connexion et réessayer.</p><button onclick="window.location.reload()">Réessayer</button></div></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Gestionnaire de requêtes hors-ligne
async function handleOfflineRequest(request) {
  try {
    // Essayer d'abord le réseau
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      return networkResponse;
    } else {
      throw new Error(`Réseau non disponible: ${networkResponse.status}`);
    }
  } catch {
    console.log('Requête hors-ligne:', request.url);
    
    // Ajouter à la file d'attente hors-ligne
    await addToOfflineQueue(request);
    
    // Retourner une réponse indiquant que la requête a été mise en file d'attente
    return new Response(
      JSON.stringify({ 
        message: 'Requête mise en file d\'attente pour synchronisation ultérieure',
        queued: true,
        timestamp: Date.now()
      }),
      { 
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Ajouter une requête à la file d'attente hors-ligne
async function addToOfflineQueue(request) {
  const queueCache = await caches.open(OFFLINE_QUEUE_CACHE);
  
  // Créer un objet de requête hors-ligne
  const offlineRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: request.method !== 'GET' ? await request.text() : null,
    timestamp: Date.now(),
    retries: 0,
    maxRetries: 3
  };
  
  // Ajouter à la file d'attente
  await queueCache.put(offlineRequest.id, new Response(JSON.stringify(offlineRequest), {
    headers: { 'Content-Type': 'application/json' }
  }));
  
  // Envoyer un message au client pour informer de la mise en file d'attente
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'OFFLINE_QUEUE_ADDED',
        data: offlineRequest
      });
    });
  });
}

// Synchronisation de la file d'attente hors-ligne
async function syncOfflineQueue() {
  const queueCache = await caches.open(OFFLINE_QUEUE_CACHE);
  const requests = await queueCache.keys();
  
  if (requests.length === 0) {
    return;
  }
  
  console.log(`Synchronisation de ${requests.length} requêtes hors-ligne`);
  
  for (const request of requests) {
    try {
      const offlineResponse = await queueCache.match(request);
      if (!offlineResponse) continue;
      
      const offlineRequest = await offlineResponse.json();
      
      // Essayer de synchroniser la requête
      const response = await fetch(offlineRequest.url, {
        method: offlineRequest.method,
        headers: offlineRequest.headers,
        body: offlineRequest.body
      });
      
      if (response.ok) {
        // Supprimer de la file d'attente
        await queueCache.delete(request);
        
        // Envoyer un message au client
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'OFFLINE_REQUEST_SYNCED',
              data: offlineRequest
            });
          });
        });
      } else {
        // Gérer les échecs
        await handleFailedRequest(offlineRequest);
      }
    } catch (error) {
      console.error(`Erreur lors de la synchronisation de la requête ${request}:`, error);
      await handleFailedRequest(await queueCache.match(request)?.json());
    }
  }
}

// Gérer les requêtes échouées
async function handleFailedRequest(offlineRequest) {
  const queueCache = await caches.open(OFFLINE_QUEUE_CACHE);
  
  // Incrémenter le nombre de tentatives
  offlineRequest.retries++;
  
  if (offlineRequest.retries >= offlineRequest.maxRetries) {
    // Trop d'échecs, supprimer de la file d'attente
    await queueCache.delete(offlineRequest.id);
    
    // Envoyer un message au client
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'OFFLINE_REQUEST_FAILED',
          data: offlineRequest
        });
      });
    });
  } else {
    // Mettre à jour avec le nouveau nombre de tentatives
    await queueCache.put(offlineRequest.id, new Response(JSON.stringify(offlineRequest), {
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

// Gestionnaire de messages
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SYNC_OFFLINE_QUEUE':
      syncOfflineQueue();
      break;
      
    case 'CLEAR_CACHE':
      if (data && data.cacheName) {
        caches.delete(data.cacheName);
      } else {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE &&
                cacheName !== OFFLINE_QUEUE_CACHE) {
              caches.delete(cacheName);
            }
          });
        });
      }
      break;
      
    case 'OPTIMIZE_CACHE':
      // L'optimisation du cache est gérée automatiquement
      break;
      
    case 'SHOW_NOTIFICATION':
      showNotification(data);
      break;
  }
});

// Gestionnaire de notifications push
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push reçu');
  
  if (event.data) {
    const data = event.data.json();
    showNotification(data);
  } else {
    showNotification({
      title: 'Notification',
      body: 'Vous avez une nouvelle notification',
      icon: '/icons/icon-192.png'
    });
  }
});

// Afficher une notification
async function showNotification(data) {
  try {
    const options = {
      body: data.body || 'Vous avez une nouvelle notification',
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'general',
      data: data.data || {},
      actions: data.actions || [],
      silent: data.silent || false,
      requireInteraction: data.requireInteraction || false
    };
    
    const registration = await self.registration;
    await registration.showNotification(data.title || 'Notification', options);
  } catch (error) {
    console.error('Erreur lors de l\'affichage de la notification:', error);
  }
}

// Gestionnaire de clic sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  
  if (data && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    );
  }
});

// Synchronisation périodique
setInterval(() => {
  syncOfflineQueue();
}, 60000); // Toutes les minutes

// Synchronisation au redémarrage
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

// Enregistrer le service worker
self.addEventListener('controllerchange', () => {
  console.log('Nouveau service worker actif');
});