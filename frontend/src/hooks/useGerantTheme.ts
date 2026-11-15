import { useCallback, useEffect, useState } from 'react';

export type GerantTheme = 'light' | 'dark';

/** Clé de persistance du thème du tableau de bord gérant. */
export const GERANT_THEME_STORAGE_KEY = 'gerant-theme';

function readStoredTheme(): GerantTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(GERANT_THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    // Stockage bloqué (navigation privée, quota) : on reste en sombre.
    return 'dark';
  }
}

/**
 * Thème clair/sombre du tableau de bord gérant.
 *
 * Le choix est mémorisé dans `localStorage` et réappliqué au prochain
 * chargement. Le défaut est le thème sombre pour une meilleure expérience
 * de lecture et pour réduire la fatigue oculaire pendant le travail.
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
