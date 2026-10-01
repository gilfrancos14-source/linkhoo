import type { MarketCode } from '../contexts/MarketContext';
import { apiTourism, type DestinationData } from '../lib/api';

export interface DestinationCard {
  id: string;
  img: string;
  alt: string;
  title: string;
  city: string;
  text: string;
  featured: boolean;
}

// Réponse de la section : `big` = grosses cartes (décidées par le serveur),
// `small` = petites cartes. On ne réordonne jamais côté client.
export interface TourismCards {
  big: DestinationCard[];
  small: DestinationCard[];
}

const FALLBACK_IMG = '/images/pexels-artbovich-7214173.jpg';

function toCard(d: DestinationData): DestinationCard {
  return {
    id: d.id,
    img: d.img || FALLBACK_IMG,
    alt: d.alt || d.title,
    title: d.title,
    city: d.city,
    text: d.description,
    featured: d.featured === true,
  };
}

// Les erreurs remontent : c'est le composant qui choisit FALLBACK_TOURISM,
// comme EventsSection le fait avec son propre contenu de secours.
export async function fetchDestinationsByMarket(market: MarketCode): Promise<TourismCards> {
  const partition = await apiTourism.list(market);
  return { big: partition.big.map(toCard), small: partition.small.map(toCard) };
}

const card = (
  id: string,
  city: string,
  title: string,
  text: string,
  img: string,
  alt: string,
): DestinationCard => ({ id, city, title, text, img, alt, featured: false });

// Repli hors ligne : la même table que `seedTourism()` (backend), déjà
// partitionnée comme le ferait la règle (ville avec événement dans les 30
// jours). Le site reste présent même si l'API est en panne — et il affiche
// exactement ce que l'API afficherait.
export const FALLBACK_TOURISM: Record<MarketCode, TourismCards> = {
  BJ: {
    big: [
      card('des-bj-tori-bossito', 'Tori Bossito', 'Tori Bossito', 'Vallées, rivières et villages : randonnées encadrées et artisanat local.', '/images/tori.jpg', 'Vallées de Tori Bossito'),
      card('des-bj-ouidah', 'Ouidah', 'Ouidah', "Plages de sable fin, cœur touristique et berceau de la mémoire de l'esclavage.", '/images/ouidah.jpg', "Plage d'Ouidah"),
    ],
    small: [
      card('des-bj-grand-popo', 'Grand Popo', 'Grand Popo', 'Une ambiance chaleureuse, une plage magnifique et une culture vivante.', '/images/tori.jpg', 'Plage de Grand Popo'),
      card('des-bj-nikki', 'Nikki', 'Nikki', 'Village lacustre aux maisons colorées sur pilotis.', '/images/pexels-artbovich-7214173.jpg', 'Maisons colorées de Nikki'),
      card('des-bj-ganvie', 'Ganvié', 'Ganvié', "Venise de l'Afrique, marchés flottants et traditions.", '/images/pexels-fotoaibe-1571460.jpg', 'Marché flottant de Ganvié'),
      card('des-bj-porto-novo', 'Porto-Novo', 'Porto-Novo', 'Capitale culturelle, architecture afro-brésilienne.', '/images/pexels-artbovich-7045712.jpg', 'Architecture de Porto-Novo'),
      card('des-bj-abomey', 'Abomey', 'Abomey', 'Palais royaux classés au patrimoine mondial UNESCO.', '/images/pexels-artbovich-6283961.jpg', 'Palais royaux d’Abomey'),
    ],
  },
  CI: {
    big: [
      card('des-ci-abidjan', 'Abidjan', 'Abidjan', 'Le Plateau, Cocody et la lagune Ébrié : énergie, maquis et scènes culturelles.', '/images/pexels-artbovich-7214173.jpg', 'Abidjan vue depuis la ville'),
      card('des-ci-bouake', 'Bouaké', 'Bouaké', 'Deuxième ville du pays : grand marché, artisanat et capitale des masques.', '/images/pexels-artbovich-6782567.jpg', 'Grand marché de Bouaké'),
    ],
    small: [
      card('des-ci-grand-bassam', 'Grand-Bassam', 'Grand-Bassam', "Première capitale du pays, classée à l'UNESCO : patrimoine créole et plages de sable fin.", '/images/pexels-fotoaibe-1571460.jpg', 'Plage de Grand-Bassam'),
      card('des-ci-assinie', 'Assinie', 'Assinie', 'Plages et lagunes entre cocotiers, à deux pas d’Abidjan.', '/images/pexels-artbovich-7045712.jpg', 'Lagune d’Assinie'),
      card('des-ci-yamoussoukro', 'Yamoussoukro', 'Yamoussoukro', 'Basilique de la Paix et jardins de la capitale politique.', '/images/pexels-artbovich-6283961.jpg', 'Basilique de Yamoussoukro'),
      card('des-ci-korhogo', 'Korhogo', 'Korhogo', 'Capitale du nord : tissages, masques et savanes.', '/images/ouidah.jpg', 'Tissages de Korhogo'),
      card('des-ci-san-pedro', 'San-Pédro', 'San-Pédro', 'Premier port du pays, plages et faune marine.', '/images/tori.jpg', 'Plage de San-Pédro'),
    ],
  },
};
