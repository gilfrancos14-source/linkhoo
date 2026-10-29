/* Préchargement des chunks de route les plus visités.
   Les pages sont chargées à la demande (`lazy()` dans App.tsx) : sans
   préchargement, un clic sur une carte affiche l'écran « Chargement… » le temps
   de télécharger le chunk. Ici, on lance les deux destinations les plus
   probables depuis l'accueil dès que la page est au repos — le téléchargement
   se fait en arrière-plan, sans concurrencer le premier rendu.
   Un `import()` du même module par `lazy()` réutilise le chunk déjà en cache :
   la navigation devient instantanée. */

const ROUTE_CHUNKS = () => [
  import('../pages/RoomDetailMaq7'),
  import('../pages/SearchResultsPage'),
];

/** Données économisées : pas de préchargement en connexion comptée / lente. */
function allowsPrefetch(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return false;
  return true;
}

export function prefetchCommonRouteChunks(): void {
  if (typeof window === 'undefined' || !allowsPrefetch()) return;

  const run = () => {
    for (const chunk of ROUTE_CHUNKS()) {
      // Jamais de rejet non géré : un chunk indisponible ne doit pas casser la
      // page — le `lazy()` réessaiera au moment du clic.
      chunk.catch(() => undefined);
    }
  };

  const requestIdle = window.requestIdleCallback;
  if (typeof requestIdle === 'function') {
    requestIdle(() => run(), { timeout: 5_000 });
  } else {
    window.setTimeout(run, 3_000);
  }
}
