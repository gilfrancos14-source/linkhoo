import type { ReactNode } from 'react';
import LandingFooter from './LandingFooter';
import MarketHeader from './MarketHeader';

/**
 * Habillage des pages de contenu du marché (pages légales) : la même barre de
 * navigation et le même pied de page que l'accueil du marché, sans embarquer
 * toute la maquette.
 */
export default function MarketLegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing">
      <div className="maquette-shell">
        <MarketHeader />
        {children}
      </div>
      <LandingFooter />
    </div>
  );
}
