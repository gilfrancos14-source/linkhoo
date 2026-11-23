import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LandingFooter from '../components/landing/LandingFooter';
import MarketHeader from '../components/landing/MarketHeader';
import { useMarket } from '../contexts/MarketContext';
import MaquetteHome from '../maquette/MaquetteHome';
import { useMaquetteData } from '../maquette/useMaquetteData';

/**
 * Accueil du marché : les sections sont des composants React alimentés par
 * l'API. Les cartes ne sont jamais inventées — une section dont la réponse est
 * vide (ou en erreur) disparaît.
 */
export default function MaquettePage() {
  const { market } = useMarket();
  const data = useMaquetteData(market);
  const location = useLocation();
  const navigate = useNavigate();

  // Depuis une autre page (fiche chambre, page légale…), la barre de navigation
  // renvoie ici avec une intention : atteindre une section ou le champ de
  // recherche. Les sections arrivent avec les données de l'API, d'où l'attente
  // bornée.
  const navState = location.state as { scrollTo?: string; focusSearch?: boolean } | null;
  const scrollTarget = navState?.scrollTo ?? null;
  const focusTarget = navState?.focusSearch ?? false;

  useEffect(() => {
    if (!scrollTarget && !focusTarget) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const target = scrollTarget
        ? document.querySelector(`[data-purpose="${scrollTarget}"]`)
        : null;
      const input = focusTarget ? document.getElementById('maquette-destination') : null;

      if (target) {
        window.clearInterval(timer);
        const top = target.getBoundingClientRect().top + window.scrollY - 16;
        window.scrollTo({ top, behavior: 'smooth' });
        navigate(`/${market.toLowerCase()}`, { replace: true, state: null });
      } else if (input) {
        window.clearInterval(timer);
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
        navigate(`/${market.toLowerCase()}`, { replace: true, state: null });
      } else if (attempts > 40) {
        window.clearInterval(timer);
      }
    }, 150);

    return () => window.clearInterval(timer);
  }, [scrollTarget, focusTarget, navigate, market]);

  return (
    <div className="landing">
      <div className="maquette-shell">
        <MarketHeader />
        <MaquetteHome market={market} data={data} />
      </div>
      <LandingFooter />
    </div>
  );
}
