import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

/**
 * Vrai tant que le navigateur estime avoir une connexion.
 * Sert à signaler le mode hors-ligne (bandeau) et à désactiver les
 * actions qui exigent le réseau (réservation, newsletter, paiement).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    // Repli côté serveur : jamais de faux « hors-ligne » au premier rendu.
    () => true,
  );
}
