import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isMarketCode, marketBySlug, type MarketCode } from '../config/markets';
import { marketSlugFromPath } from '../contexts/MarketContext';
import { apiDiscover, type DetectedMarketResponse } from '../lib/api';

/**
 * Marché déduit de la position du visiteur (géolocalisation IP côté backend).
 * `null` tant que la détection n'a pas répondu, si le pays est inconnu ou si
 * le réseau est indisponible.
 */
export function useDetectedMarket(enabled = true): MarketCode | null {
  const [market, setMarket] = useState<MarketCode | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    // Un mock partiel de l'API (tests, ancien bundle) ne doit jamais faire
    // planter le rendu pour un simple lien de navigation.
    const detect = apiDiscover.market;
    if (typeof detect !== 'function') return;

    detect()
      .then((data: DetectedMarketResponse) => {
        if (alive) setMarket(isMarketCode(data?.market) ? data.market : null);
      })
      .catch(() => {
        // Détection non bloquante : l'appelant garde son marché de repli.
      });

    return () => {
      alive = false;
    };
  }, [enabled]);

  return market;
}

/**
 * Marché à utiliser pour les liens de compte (connexion, inscription,
 * « Devenir hôte »).
 *
 * - Sur une page de marché (/bj/chambre/…, /sn/recherche…), l'URL fait foi ;
 * - à la racine (accueil, /a-propos, /contact), aucun marché n'est choisi : on
 *   prend le pays où se trouve le visiteur, détecté par son IP ;
 * - repli CI le temps de la détection ou si elle échoue (comportement initial).
 */
export function useHostMarket(): MarketCode {
  const { pathname } = useLocation();
  const slug = marketSlugFromPath(pathname);
  const fromUrl = slug ? marketBySlug(slug)?.code ?? null : null;
  const detected = useDetectedMarket(!fromUrl);
  return fromUrl ?? detected ?? 'CI';
}
