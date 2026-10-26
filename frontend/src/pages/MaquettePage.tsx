import { useCallback } from 'react';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeader from '../components/landing/LandingHeader';
import { COUNTRIES } from '../components/landing/data';
import { useMarket } from '../contexts/MarketContext';
import MaquetteHome from '../maquette/MaquetteHome';
import { MAQUETTE_NAV_ITEMS as NAV_ITEMS } from '../maquette/nav';
import { useMaquetteData } from '../maquette/useMaquetteData';

/**
 * Accueil du marché : les sections sont des composants React alimentés par
 * l'API. Les cartes ne sont jamais inventées — une section dont la réponse est
 * vide (ou en erreur) disparaît.
 */
export default function MaquettePage() {
  const { market } = useMarket();
  const data = useMaquetteData(market);
  const country = COUNTRIES.find((item) => item.code === market) ?? COUNTRIES[0];

  const scrollToSection = useCallback((purpose: string) => {
    const target = document.querySelector(`[data-purpose="${purpose}"]`);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const focusSearch = useCallback(() => {
    const input = document.getElementById('maquette-destination');
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }, []);

  return (
    <div className="landing">
      <div className="maquette-shell">
        <LandingHeader
          country={country}
          onCountryClick={() => {}}
          onSearchClick={focusSearch}
          items={NAV_ITEMS}
          onItemClick={scrollToSection}
          brandTo={`/${market.toLowerCase()}`}
          account={{ to: `/${market.toLowerCase()}/compte`, label: 'Mon espace' }}
        />
        <MaquetteHome market={market} data={data} />
      </div>
      <LandingFooter />
    </div>
  );
}
