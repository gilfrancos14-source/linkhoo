/**
 * Bouton hamburger pour ouvrir la sidebar sur mobile.
 * À placer dans l'en-tête de chaque page blank du dashboard gérant.
 */
export function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-dash-navy lg:hidden"
      onClick={onOpen}
      aria-label="Ouvrir le menu"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default MobileMenuButton;
