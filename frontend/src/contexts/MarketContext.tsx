import { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isMarketSlug, marketBySlug, type MarketCode, type MarketSlug } from '../config/markets';

// Le type vient du registre (config/markets.ts) : source de vérité unique,
// figée par le test de synchronisation avec le miroir backend.
export type { MarketCode };

interface MarketContextValue {
  market: MarketCode;
  setMarket: (m: MarketCode) => void;
}

const MarketContext = createContext<MarketContextValue | null>(null);

// Slug de marché réellement présent dans l'URL, ou null hors /ci|/bj|/sn|…
// useParams() renvoie vide sur les routes /admin de la racine et sur les
// <Routes> imbriqués : construire les URLs depuis le pathname évite
// d'obtenir des liens « /undefined/... ».
export function marketSlugFromPath(pathname: string): MarketSlug | null {
  const segment = pathname.split('/')[1];
  return isMarketSlug(segment) ? segment : null;
}

// Page servie à la racine (accueil, /a-propos, /contact) : aucun segment de
// marché dans l'URL. Ces pages partagent la barre de navigation de l'accueil.
export function isRootPath(pathname: string): boolean {
  return marketSlugFromPath(pathname) === null;
}

// Le marché est DÉRIVÉ de l'URL à chaque render : aucun état miroir, donc
// aucun décalage entre la route et le marché affiché (pas de render avec
// l'ancien marché, pas de double fetch, pas de flash de thème).
// Aucune persistance : les segments /ci, /bj, /sn, … sont la seule source
// de vérité.
// Hors segment de marché, on retombe sur CI — valeur jamais lue, car aucun
// consommateur n'existe en dehors des routes de marché (MarketRoute invalide
// redirige sur /).
function marketFromPath(pathname: string): MarketCode {
  const slug = marketSlugFromPath(pathname);
  return slug ? marketBySlug(slug)?.code ?? 'CI' : 'CI';
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const market = marketFromPath(pathname);
  const slug = marketSlugFromPath(pathname);

  // data-market pilote le thème (index.css). useLayoutEffect s'exécute avant
  // le paint : sans ça, l'ancien thème s'affiche un frame à chaque changement.
  // Hors segment de marché (racine, /admin racine) l'attribut est retiré : la
  // page reprend le thème bleu plateforme de :root au lieu du thème marché.
  useLayoutEffect(() => {
    if (slug) {
      document.documentElement.setAttribute('data-market', market);
    } else {
      document.documentElement.removeAttribute('data-market');
    }
  }, [market, slug]);

  const value = useMemo<MarketContextValue>(
    () => ({
      market,
      // Navigation « push » : le retour du navigateur doit revenir à la
      // page précédente (l'accueil par exemple), pas sauter dessus.
      setMarket: (m: MarketCode) => navigate(`/${m.toLowerCase()}`),
    }),
    [market, navigate],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}
