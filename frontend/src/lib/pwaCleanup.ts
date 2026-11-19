/**
 * Purge des données locales liées à une session avant déconnexion.
 *
 * Le Cache API est partagé par toutes les origines du navigateur et sa clé est
 * l'URL (pas l'en-tête Authorization) : sans cette purge, un compte B ouvert
 * après le compte A sur le même poste recevrait les réponses API mises en cache
 * pour A. On vide donc le cache dynamique, les anciennes versions et les deux
 * files d'attente (CacheStorage + IndexedDB + localStorage).
 */

const CACHE_NAMES = [
  'ilehya-dynamic-v4',
  'ilehya-offline-queue-v4',
  // Anciennes versions, au cas où un SW v3 serait encore actif.
  'ilehya-dynamic-v3',
  'ilehya-offline-queue-v3',
];

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve();
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export async function clearSessionCaches(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'CLEAR_CACHE',
        data: { cacheName: 'ilehya-dynamic-v4' },
      });
    }
    if (typeof caches !== 'undefined') {
      await Promise.all(CACHE_NAMES.map((name) => caches.delete(name).catch(() => false)));
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('linkhoo:offline-queue');
    }
    await deleteIndexedDb('linkhoo-pwa');
  } catch {
    // La purge est un best-effort : la déconnexion ne doit jamais échouer.
  }
}
