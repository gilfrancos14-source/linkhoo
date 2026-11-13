import { useEffect, useState } from 'react';
import { clientSidebarStore, useClientSidebar } from '../../lib/clientSidebarStore';

/**
 * Bouton hamburger de l'espace client.
 *
 * Sur mobile, il ouvre et ferme le tiroir de navigation ; sur ordinateur, il
 * réduit la sidebar à un rail. Même comportement que l'espace gérant, pour
 * que les deux tableaux de bord se ressemblent.
 */
function useDrawerMode(): boolean {
  const [isDrawer, setIsDrawer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1024px)');
    const onChange = () => setIsDrawer(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isDrawer;
}

export default function ClientSidebarToggle({ className = '' }: { className?: string }) {
  const { open, collapsed } = useClientSidebar();
  const isDrawer = useDrawerMode();

  const label = isDrawer
    ? open
      ? 'Fermer le menu'
      : 'Ouvrir le menu'
    : collapsed
      ? 'Afficher le menu'
      : 'Réduire le menu';

  return (
    <button
      type="button"
      className={`client-sidebar-btn ${className}`.trim()}
      onClick={() => {
        if (isDrawer) {
          clientSidebarStore.toggle();
        } else {
          clientSidebarStore.toggleCollapsed();
        }
      }}
      aria-label={label}
      aria-expanded={isDrawer ? open : !collapsed}
      aria-pressed={isDrawer ? undefined : collapsed}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 6h18M3 12h18M3 18h18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
