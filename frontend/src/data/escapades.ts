import type { MarketCode } from '../contexts/MarketContext';
import { apiEscapades, type EscapadeData } from '../lib/api';

// Carte de la section Escapade weekend. images[0] = couverture ; le carrousel
// complet s'affiche dans le panneau de détail. alt est dérivé de `lieu` au
// rendu (pas de champ dédié côté base).
export interface EscapadeCard {
  id: string;
  lieu: string;
  text: string;
  /** Couverture de la carte (images[0] de la base, jamais d'image inventée). */
  cover: string;
  /** Carrousel complet des images (au moins une : la couverture). */
  images: string[];
}

// Pas de fallback : liste vide ou erreur → le composant rend null (section
// disparaît). Contrairement à TourismSection, on ne montre jamais de cartes
// inventées en secours.
export async function fetchEscapadesByMarket(market: MarketCode): Promise<EscapadeCard[]> {
  const escapades = await apiEscapades.list(market);
  return escapades.map((e: EscapadeData) => {
    const images = Array.isArray(e.images) && e.images.length > 0 ? e.images : [];
    return {
      id: e.id,
      lieu: e.lieu,
      text: e.description,
      cover: images[0] ?? '',
      images,
    };
  });
}
