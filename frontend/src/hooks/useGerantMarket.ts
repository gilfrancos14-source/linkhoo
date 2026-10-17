import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiGerants } from '../lib/api';
import type { MarketCode } from '../config/markets';

// Cache module-level : le résultat de getMe() est partagé entre tous les
// composants consommateurs (MarketSelector, CountrySelector, …) pour ne
// faire qu'UN seul appel API par session.
let cachedMarket: MarketCode | null = null;
let cachedPromise: Promise<MarketCode | null> | null = null;

function fetchGerantMarket(): Promise<MarketCode | null> {
  if (cachedPromise) return cachedPromise;
  cachedPromise = apiGerants.getMe()
    .then((gerant) => {
      cachedMarket = gerant.market;
      return cachedMarket;
    })
    .catch(() => {
      // Pas gérant ou erreur réseau : on retente au prochain mount.
      cachedPromise = null;
      return null;
    });
  return cachedPromise;
}

/**
 * Marché du gérant connecté, ou null si l'utilisateur n'est pas gérant.
 * Le résultat est mis en cache : un seul appel `GET /gerants/me` par session.
 *
 * @returns gerantMarket — code marché (ex. "CI") ou null
 * @returns loading     — true tant que le statut gérant n'est pas résolu
 *                        (utile pour éviter un flash de contenu cliquable)
 */
export function useGerantMarket(): { gerantMarket: MarketCode | null; loading: boolean } {
  const { isSignedIn, isLoaded } = useAuth();
  const [gerantMarket, setGerantMarket] = useState<MarketCode | null>(cachedMarket);
  const [loading, setLoading] = useState(isLoaded && isSignedIn && cachedMarket === null && cachedPromise === null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setGerantMarket(null);
      setLoading(false);
      return;
    }
    // Déjà en cache → pas de loading
    if (cachedMarket !== null) {
      setGerantMarket(cachedMarket);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchGerantMarket().then((market) => {
      if (cancelled) return;
      setGerantMarket(market);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  return { gerantMarket, loading };
}

/** Réinitialise le cache (à utiliser dans les tests). */
export function resetGerantMarketCache() {
  cachedMarket = null;
  cachedPromise = null;
}
