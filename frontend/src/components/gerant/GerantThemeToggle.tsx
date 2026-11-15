import { useGerantTheme } from '../../hooks/useGerantTheme';

/**
 * Bascule sombre / clair du tableau de bord gérant.
 *
 * Partagé par le layout (`AdminLayout`, chrome admin) et les pages qui
 * reproduisent une maquette complète (dashboard, chambres, etc.).
 */
export default function GerantThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useGerantTheme();

  return (
    <button
      type="button"
      className={`gerant-theme-toggle card grid h-11 w-11 shrink-0 place-items-center text-dash-navy ${className}`}
      aria-label={isDark ? 'Désactiver le mode sombre' : 'Activer le mode sombre'}
      aria-pressed={isDark}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      onClick={toggleTheme}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      )}
    </button>
  );
}
