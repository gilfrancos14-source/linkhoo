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
// Pour les 10 marchés ouverts : 5 destinations par marché (mêmes ids et
// descriptions que le seed backend), big = les 2 premières, small = les 3
// suivantes.
const TOUR_IMG = {
  ville: '/images/pexels-artbovich-7214173.jpg',
  plage: '/images/tori.jpg',
  culture: '/images/ouidah.jpg',
  nature: '/images/pexels-fotoaibe-1571460.jpg',
  hotel: '/images/pexels-artbovich-7045712.jpg',
} as const;

type NewSeed = readonly [id: string, city: string, title: string, text: string, img: string];

function toFallback(seeds: readonly NewSeed[]): TourismCards {
  const cards: DestinationCard[] = seeds.map(([id, city, title, text, img]) => ({
    id,
    city,
    title,
    text,
    img,
    alt: title,
    featured: false,
  }));
  return { big: cards.slice(0, 2), small: cards.slice(2) };
}

// CI et BJ ont leur repli écrit à la main ci-dessous (contenu historique) :
// ce tableau ne couvre que les 10 marchés ouverts en v2.
const NEW_MARKET_TOURISM: Record<Exclude<MarketCode, 'CI' | 'BJ'>, NewSeed[]> = {
  SN: [
    ['des-sn-goree', 'Dakar', 'Île de Gorée', 'Île historique classée à l’UNESCO, maisons colorées et mémoire de la traite.', TOUR_IMG.culture],
    ['des-sn-lac-rose', 'Rufisque', 'Lac Rose', 'Lac aux eaux roses et salines à une heure de Dakar.', TOUR_IMG.plage],
    ['des-sn-saint-louis', 'Saint-Louis', 'Saint-Louis', 'Ancienne capitale coloniale sur une île, classée à l’UNESCO.', TOUR_IMG.ville],
    ['des-sn-saly', 'Saly', 'Saly', 'Station balnéaire de la côte atlantique : plages et golf.', TOUR_IMG.plage],
    ['des-sn-popenguine', 'Popenguine', 'Popenguine', 'Sanctuaire, plage tranquille et réserve naturelle du Nord.', TOUR_IMG.nature],
  ],
  TG: [
    ['des-tg-lome', 'Lomé', 'Lomé', 'Capitale sur la lagune : grand marché, Quartier allemand et front de mer.', TOUR_IMG.ville],
    ['des-tg-kpalime', 'Kpalimé', 'Kpalimé', 'Ville des chutes et de la forêt, randonnées dans les montagnes de l’ouest.', TOUR_IMG.nature],
    ['des-tg-anho', 'Aného', 'Aného', 'Ancienne capitale sur le lagon : maisons coloniales et plages.', TOUR_IMG.plage],
    ['des-tg-togoville', 'Togoville', 'Togoville', 'Ville historique du lagon, berceau du royaume des Ewe.', TOUR_IMG.culture],
    ['des-tg-kara', 'Kara', 'Kara', 'Plateaux du nord, culture kabyè et randonnées.', TOUR_IMG.nature],
  ],
  CM: [
    ['des-cm-douala', 'Douala', 'Douala', 'Capitale économique : Bonanjo, marché du Wouri et vie nocturne.', TOUR_IMG.ville],
    ['des-cm-yaounde', 'Yaoundé', 'Yaoundé', 'Capitale politique sur sept collines, musées et marchés.', TOUR_IMG.hotel],
    ['des-cm-kribi', 'Kribi', 'Kribi', 'Plages de sable fin et chutes de la Lobé qui se jettent dans la mer.', TOUR_IMG.plage],
    ['des-cm-bafoussam', 'Bafoussam', 'Bafoussam', 'Capitale des Hauts-Plateaux : marché des Batie et royautés bamiléké.', TOUR_IMG.nature],
    ['des-cm-limbe', 'Limbe', 'Limbe', 'Ville volcanique : plages de sable noir et parc zoologique.', TOUR_IMG.plage],
  ],
  BF: [
    ['des-bf-ouagadougou', 'Ouagadougou', 'Ouagadougou', 'Capitale des artisans : Grande Mosquée, marché Rood Woko et zoma.', TOUR_IMG.ville],
    ['des-bf-bobo', 'Bobo-Dioulasso', 'Bobo-Dioulasso', 'Deuxième ville du pays : grande mosquée en banco et marché central.', TOUR_IMG.culture],
    ['des-bf-gorom', 'Gorom-Gorom', 'Gorom-Gorom', 'Marché du jeudi touareg en plein cœur du Sahel.', TOUR_IMG.nature],
    ['des-bf-banfora', 'Banfora', 'Banfora', 'Portes des cascades de Karfiguéla et des plantations de canne.', TOUR_IMG.nature],
    ['des-bf-sindou', 'Sindou', 'Pics de Sindou', 'Empreintes de roches sculptées par l’érosion, au pays kassena.', TOUR_IMG.hotel],
  ],
  CG: [
    ['des-cg-brazzaville', 'Brazzaville', 'Brazzaville', 'Basilique Sainte-Anne, Plateau des 15 ans et marchés de Bacongo.', TOUR_IMG.ville],
    ['des-cg-pointenoire', 'Pointe-Noire', 'Pointe-Noire', 'Capitale pétrolière : plage de La Pointe et marchés.', TOUR_IMG.plage],
    ['des-cg-ouesso', 'Ouesso', 'Ouesso', 'Porte du parc national de Nouabalé-Ndoki, forêt primaire.', TOUR_IMG.nature],
    ['des-cg-dolissie', 'Dolissie', 'Dolissie', 'Ville du Niari, portes des chutes et des plateaux.', TOUR_IMG.nature],
    ['des-cg-sibiti', 'Sibiti', 'Sibiti', 'Ville des Lékoumou, case à palabres et chutes de Kondoro.', TOUR_IMG.culture],
  ],
  GA: [
    ['des-ga-libreville', 'Libreville', 'Libreville', 'Capitale sur l’estuaire : batterie IV, aquarium et marchés.', TOUR_IMG.ville],
    ['des-ga-pongara', 'Libreville', 'Réserve de Pongara', 'Forêt mangrove et plages à une heure de la capitale.', TOUR_IMG.plage],
    ['des-ga-portgentil', 'Port-Gentil', 'Port-Gentil', 'Îles et plages de la province de l’Ogooué-Maritime.', TOUR_IMG.plage],
    ['des-ga-lope', 'Franceville', 'Parc de la Lopé', 'Savanes et forêts du centre du Gabon, classées UNESCO.', TOUR_IMG.nature],
    ['des-ga-lambarene', 'Lambaréné', 'Lambaréné', 'Hôpital Albert Schweitzer et îles de l’Ogooué.', TOUR_IMG.culture],
  ],
  GN: [
    ['des-gn-conakry', 'Conakry', 'Conakry', 'Péninsule de Kaloum : grand marché de Sandaka et front de mer.', TOUR_IMG.ville],
    ['des-gn-iles-los', 'Conakry', 'Îles de Los', 'Petites îles rocheuses à un braquet du continent.', TOUR_IMG.plage],
    ['des-gn-labe', 'Labé', 'Labé', 'Capitale du Fouta Djallon : montagnes, chutes et marchés de bétail.', TOUR_IMG.nature],
    ['des-gn-kindia', 'Kindia', 'Kindia', 'Chutes de la Soumba et plantations de fruits du pays de la mangue.', TOUR_IMG.nature],
    ['des-gn-dalaba', 'Dalaba', 'Dalaba', 'Ville fraîche des montagnes du Fouta, bains et randonnées.', TOUR_IMG.hotel],
  ],
  ML: [
    ['des-ml-bamako', 'Bamako', 'Bamako', 'Capitale sur le Niger : grande mosquée, musée national et marché de Medina.', TOUR_IMG.ville],
    ['des-ml-mont-bamako', 'Bamako', 'Mont Bamako', 'Promontoire dominant la ville, vue panoramique sur le fleuve.', TOUR_IMG.nature],
    ['des-ml-segou', 'Ségou', 'Ségou', 'Ancienne capitale bambara : artisanat, Bognokoli et bords du Niger.', TOUR_IMG.culture],
    ['des-ml-mopti', 'Mopti', 'Mopti', 'Port fluvial du Niger : embarcations et grand marché.', TOUR_IMG.nature],
    ['des-ml-djenne', 'Djenné', 'Djenné', 'Cité en banco et grande mosquée, classée UNESCO.', TOUR_IMG.culture],
  ],
  NE: [
    ['des-ne-niamey', 'Niamey', 'Niamey', 'Capitale sur le Niger : grande mosquée, marché et île du hippopotame.', TOUR_IMG.ville],
    ['des-ne-agadez', 'Agadez', 'Agadez', 'Cité caravanière de l’Aïr, médina de banco classée UNESCO.', TOUR_IMG.culture],
    ['des-ne-zinder', 'Zinder', 'Zinder', 'Ancienne capitale : palais du Sultan et grand marché.', TOUR_IMG.culture],
    ['des-ne-maradi', 'Maradi', 'Maradi', 'Ville commerçante du sud, marché du bétail et dombés.', TOUR_IMG.hotel],
    ['des-ne-tillaberi', 'Tillabéri', 'Tillabéri', 'Rives du Niger et portes du parc W.', TOUR_IMG.nature],
  ],
  CD: [
    ['des-cd-kinshasa', 'Kinshasa', 'Kinshasa', 'Mégalopole sur le Congo : Gombe, marchés de Ngaba et corniche.', TOUR_IMG.ville],
    ['des-cd-goma', 'Goma', 'Goma', 'Lac Kivu, sable noir volcanique et vue sur le Nyiragongo.', TOUR_IMG.nature],
    ['des-cd-lubumbashi', 'Lubumbashi', 'Lubumbashi', 'Capitale du Haut-Katanga : mines, musées et kifumbu.', TOUR_IMG.hotel],
    ['des-cd-kisangani', 'Kisangani', 'Kisangani', 'Ville des chutes de Boyoma, sur l’Equateur.', TOUR_IMG.nature],
    ['des-cd-bukavu', 'Bukavu', 'Bukavu', 'Jardin botanique de Kalembelembe et rive sud du lac Kivu.', TOUR_IMG.plage],
  ],
};

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
  SN: toFallback(NEW_MARKET_TOURISM.SN),
  TG: toFallback(NEW_MARKET_TOURISM.TG),
  CM: toFallback(NEW_MARKET_TOURISM.CM),
  BF: toFallback(NEW_MARKET_TOURISM.BF),
  CG: toFallback(NEW_MARKET_TOURISM.CG),
  GA: toFallback(NEW_MARKET_TOURISM.GA),
  GN: toFallback(NEW_MARKET_TOURISM.GN),
  ML: toFallback(NEW_MARKET_TOURISM.ML),
  NE: toFallback(NEW_MARKET_TOURISM.NE),
  CD: toFallback(NEW_MARKET_TOURISM.CD),
};
