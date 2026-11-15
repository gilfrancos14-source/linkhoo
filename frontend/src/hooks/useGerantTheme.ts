import { useCallback, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type GerantTheme = 'light' | 'dark';

/** Clé de persistance du thème du tableau de bord gérant. */
export const GERANT_THEME_STORAGE_KEY = 'gerant-theme';

function readStoredTheme(): GerantTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(GERANT_THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

// Store partagé (module-level) pour que toutes les instances du hook
// (layout + pages) restent synchronisées, même sans fournisseur de contexte.
let currentTheme: GerantTheme = readStoredTheme();
const listeners = new Set<() => void>();

function setTheme(next: GerantTheme) {
  if (next === currentTheme) return;
  currentTheme = next;
  try {
    window.localStorage.setItem(GERANT_THEME_STORAGE_KEY, next);
  } catch {
    // Le thème reste valable pour la session en cours.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): GerantTheme {
  return currentTheme;
}

function getServerSnapshot(): GerantTheme {
  return 'dark';
}

/**
 * Thème clair/sombre du tableau de bord gérant.
 *
 * État partagé au niveau du module : le bouton de bascule agit sur toutes
 * les pages simultanément (layout + pages rendues dans `<Outlet />`).
 */
export function useGerantTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, isDark: theme === 'dark', toggleTheme };
}

// Fournisseur optionnel conservé pour compatibilité (no-op : le store est
// déjà partagé au niveau du module).
export function GerantThemeProvider({ children }: { children: ReactNode }) {
  return children;
}