import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { MAQUETTE_NAV_ITEMS } from '../../maquette/nav';
import LandingHeader from './LandingHeader';

/**
 * Barre de navigation de l'accueil du marché (/ci, /bj…), réutilisée par les
 * pages de contenu qui n'embarquent pas toute la maquette (pages légales).
 *
 * Sur l'accueil, les entrées pointent vers des sections de la page : on fait
 * défiler directement. Depuis une autre page, on revient sur l'accueil du
 * marché en confiant l'intention à MaquettePage (location.state), qui attend
 * que les sections issues de l'API soient montées.
 */
export default function MarketHeader() {
  const { market } = useMarket();
  const location = useLocation();
  const navigate = useNavigate();

  const homePath = `/${market.toLowerCase()}`;
  const onHome =
    location.pathname === homePath || location.pathname === `${homePath}/`;

  const scrollToSection = useCallback((purpose: string) => {
    const target = document.querySelector(`[data-purpose="${purpose}"]`);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const onItemClick = useCallback(
    (href: string) => {
      if (onHome) {
        scrollToSection(href);
        return;
      }
      navigate(homePath, { state: { scrollTo: href } });
    },
    [homePath, navigate, onHome, scrollToSection],
  );

  return (
    <LandingHeader
      items={MAQUETTE_NAV_ITEMS}
      onItemClick={onItemClick}
      brandTo={homePath}
      showActions={false}
      auth={{
        signupTo: `${homePath}/inscription/client`,
        loginTo: `${homePath}/login`,
      }}
    />
  );
}
