/* Enregistrement du service worker.
   Triple garde-fou :
   1. `import.meta.env.PROD` — en dev, aucun SW : HMR et serveur de dev
      intacts (Vite remplace la constante à la construction).
   2. `VITE_SW=false` — kill switch : désinscription + purge complète de
      tous les caches `linkhoo-*` (rollback sans reconstruire le code).
   3. Test de disponibilité de l'API ServiceWorker (jsdom, vieux navigateurs).
   Le service worker n'est exposé en dev par aucune voie : vite.config.ts
   renvoie en plus un 404 sur /sw.js tant que `serve` est actif. */

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (import.meta.env.VITE_SW === 'false') {
    void unregisterAndPurge();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err: unknown) => {
        // Non bloquant : le site reste utilisable sans offline.
        console.warn('[sw] enregistrement impossible', err);
      });
  });
}

async function unregisterAndPurge(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('linkhoo-')).map((k) => caches.delete(k)),
      );
    }
  } catch {
    // Rien à purger (premier chargement, API absente).
  }
}
