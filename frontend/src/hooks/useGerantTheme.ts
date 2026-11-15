import { useCallback, useEffect, useState } from 'react';

export type GerantTheme = 'light' | 'dark';

/** Clé de persistance du thème du tableau de bord gérant. */
export const GERANT_THEME_STORAGE_KEY = 'gerant-theme';

function readStoredTheme(): GerantTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(GERANT_THEME_STORAGE_KEY) === 'dark'
      ? 'dark'
      : 'light';
  } catch {
    // Stockage bloqué (navigation privée, quota) : on reste en clair.
    return 'light';
  }
}

/**
 * Thème clair/sombre du tableau de bord gérant.
 *
 * Le choix est mémorisé dans `localStorage` et réappliqué au prochain
 * chargement. Le défaut reste le thème clair : on ne suit pas
 * `prefers-color-scheme`, pour ne pas changer l'apparence des gérants qui
 * n'ont jamais demandé le mode sombre.
 */
export function useGerantTheme() {
  const [theme, setTheme] = useState<GerantTheme>(readStoredTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(GERANT_THEME_STORAGE_KEY, theme);
    } catch {
      // Le thème reste valable pour la session en cours.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, isDark: theme === 'dark', toggleTheme };
}
