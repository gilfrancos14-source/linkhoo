import { useSyncExternalStore } from 'react';

/**
 * État partagé de la sidebar de l'espace client.
 *
 * La sidebar est rendue par plusieurs pages (tableau de bord, séjours,
 * favoris, messages, compte) qui n'ont pas toutes la même barre du haut :
 * un store externe permet à la sidebar ET au bouton hamburger de parler le
 * même état, sans obliger chaque page à fournir un contexte.
 *
 * Deux notions, comme dans l'espace gérant :
 *  - `open` : le tiroir est ouvert (mobile) ;
 *  - `collapsed` : la sidebar est réduite à un rail (ordinateur), état
 *    mémorisé dans localStorage.
 */

const STORAGE_KEY = 'client-sidebar';

let open = false;
let collapsed = false;
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* stockage indisponible (navigation privée) : l'état ne sera pas mémorisé */
  }
}

collapsed = readCollapsed();

/**
 * Instantané stable : `useSyncExternalStore` exige que `getSnapshot` renvoie
 * la MÊME référence tant que l'état n'a pas changé (sinon React détecte une
 * boucle infinie et lève une erreur).
 */
let snapshot = { open, collapsed };

function emit(): void {
  snapshot = { open, collapsed };
  for (const listener of listeners) listener();
}

export const clientSidebarStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): { open: boolean; collapsed: boolean } {
    return snapshot;
  },
  open(): void {
    if (open) return;
    open = true;
    emit();
  },
  close(): void {
    if (!open) return;
    open = false;
    emit();
  },
  toggle(): void {
    open = !open;
    emit();
  },
  setCollapsed(value: boolean): void {
    if (collapsed === value) return;
    collapsed = value;
    writeCollapsed(value);
    emit();
  },
  toggleCollapsed(): void {
    clientSidebarStore.setCollapsed(!collapsed);
  },
};

/** Abonnement React à l'état de la sidebar. */
export function useClientSidebar(): { open: boolean; collapsed: boolean } {
  return useSyncExternalStore(
    clientSidebarStore.subscribe,
    clientSidebarStore.getSnapshot,
    clientSidebarStore.getSnapshot,
  );
}
