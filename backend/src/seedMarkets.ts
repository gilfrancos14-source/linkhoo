/**
 * Contenu d'ouverture des 10 nouveaux marchés (SN, TG, CM, BF, CG, GA, GN,
 * ML, NE, CD) pour `npm run seed`.
 *
 * - CI et BJ gardent leur contenu historique dans seed.ts (inchangé).
 * - Catégories : EXACTEMENT le modèle CI (4), ids préfixés du slug.
 * - ~7 chambres / ~5 événements / ~7 destinations par pays, sur les
 *   vraies villes du pays.
 * - Idempotence identique au reste du seed : ids fixes, insert si absent
 *   (événements/destinations) ou upsert (catégories/chambres).
 *
 * Les images réutilisent le pool existant de public/images.
 */

import type { MarketCode } from './config/markets';
import { MARKETS } from './config/markets';

export type RoomSeed = {
  id: string;
  title: string;
  subtitle: string;
  info: string;
  price: string;
  price_num: number;
  price_unit: string;
  img: string;
  alt: string;
  images: string[];
  description: string;
  capacity: string;
  category: string;
  market: MarketCode;
  pays: string;
  ville: string;
  quartier: string;
  chambres: number;
  douches: number;
  disponible: boolean;
  date_dispo: string;
  conditions: string;
};

export type EventSeed = {
  id: string;
  market: MarketCode;
  city: string;
  title: string;
  description: string;
  inDays: number;
  img: string;
  alt: string;
};

export type TourismSeed = {
  id: string;
  market: MarketCode;
  city: string;
  title: string;
  description: string;
  img: string;
  alt: string;
};

/** Marchés ouverts lors de l'ouverture (hors CI/BJ au contenu historique). */
const NEW_MARKET_CODES = [
  'SN',
  'TG',
  'CM',
  'BF',
  'CG',
  'GA',
  'GN',
  'ML',
  'NE',
  'CD',
] as const;

const NEW_MARKET_SET: readonly MarketCode[] = NEW_MARKET_CODES;

export function isNewMarket(code: MarketCode): boolean {
  return NEW_MARKET_SET.includes(code);
}

// ── Catégories : modèle CI, ids préfixés du slug ─────────────────────────

const CI_CATEGORY_MODEL = [
  { key: 'chambres-moins-cheres', title: 'Chambres moins chères', img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Chambres abordables' },
  { key: 'chambres-premium', title: 'Chambres premium', img: '/images/pexels-artbovich-6782567.jpg', alt: 'Chambres premium' },
  { key: 'appartements', title: 'Appartements', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Appartements' },
  { key: 'hotels', title: 'Hôtels', img: '/images/pexels-artbovich-7045712.jpg', alt: "Chambres d'hôtel" },
] as const;

type CategoryKey = (typeof CI_CATEGORY_MODEL)[number]['key'];

/** Ids de catégories d'un marché : `sn-appartements`, `sn-chambres-premium`, … */
export function categoryIdsFor(slug: string): Record<CategoryKey, string> {
  return Object.fromEntries(
    CI_CATEGORY_MODEL.map((c) => [c.key, `${slug}-${c.key}`]),
  ) as Record<CategoryKey, string>;
}

export const newMarketCategories = NEW_MARKET_CODES.flatMap((code) => {
  const market = MARKETS.find((m) => m.code === code)!;
  return CI_CATEGORY_MODEL.map((c) => ({
    id: `${market.slug}-${c.key}`,
    title: c.title,
    img: c.img,
    alt: c.alt,
    market: market.code,
  }));
});

// ── Chambres ─────────────────────────────────────────────────────────────

type CategoryTemplate = {
  noun: string;
  subtitle: string;
  info: string;
  capacity: string;
  chambres: number;
  douches: number;
  unit: '/ mois' | '/ nuit';
  conditions: string;
  img: string;
  second: string;
  description: (ville: string, quartier: string) => string;
};

const ROOM_TEMPLATES: Record<CategoryKey, CategoryTemplate> = {
  appartements: {
    noun: 'Appartement',
    subtitle: 'Appartement confortable',
    info: '65 m² · 2 chambres · Balcon',
    capacity: '4 personnes',
    chambres: 2,
    douches: 1,
    unit: '/ mois',
    conditions: 'Caution : 2 mois, Durée minimale : 6 mois',
    img: '/images/pexels-artbovich-7214173.jpg',
    second: '/images/pexels-artbovich-7045712.jpg',
    description: (ville, quartier) =>
      `Appartement lumineux dans le quartier ${quartier} à ${ville}, à proximité des commerces et des transports.`,
  },
  'chambres-moins-cheres': {
    noun: 'Chambre Meublée',
    subtitle: 'Chambre simple et abordable',
    info: '18 m² · 1 chambre · Meublé',
    capacity: '1 personne',
    chambres: 1,
    douches: 1,
    unit: '/ mois',
    conditions: 'Caution : 1 mois, Durée minimale : 3 mois',
    img: '/images/pexels-fotoaibe-1571460.jpg',
    second: '/images/pexels-artbovich-5998120.jpg',
    description: (ville, quartier) =>
      `Chambre meublée à ${quartier} à ${ville}, idéale pour un séjour prolongé au meilleur prix.`,
  },
  'chambres-premium': {
    noun: 'Studio Élégant',
    subtitle: 'Studio moderne et équipé',
    info: '35 m² · 1 chambre · Meublé',
    capacity: '2 personnes',
    chambres: 1,
    douches: 1,
    unit: '/ mois',
    conditions: 'Caution : 2 mois, Durée minimale : 6 mois',
    img: '/images/pexels-artbovich-6782567.jpg',
    second: '/images/pexels-artbovich-6758771.jpg',
    description: (ville, quartier) =>
      `Studio moderne et entièrement meublé à ${quartier}, ${ville}, proche des axes principaux.`,
  },
  hotels: {
    noun: 'Suite Hôtelière',
    subtitle: 'Suite avec services d’hôtel',
    info: '38 m² · 3 pers. · Petit-déj. inclus',
    capacity: '3 personnes',
    chambres: 1,
    douches: 1,
    unit: '/ nuit',
    conditions: 'Réservation en ligne, Annulation gratuite 48h avant',
    img: '/images/pexels-artbovich-6758771.jpg',
    second: '/images/pexels-artbovich-6315808.jpg',
    description: (ville, quartier) =>
      `Suite hôtelière confortable à ${quartier} à ${ville}, petit-déjeuner inclus.`,
  },
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type RoomSpec = {
  ville: string;
  quartier: string;
  cat: CategoryKey;
  price: number;
  disponible?: boolean;
};

function buildRoom(marketCode: MarketCode, spec: RoomSpec): RoomSeed {
  const market = MARKETS.find((m) => m.code === marketCode)!;
  const tpl = ROOM_TEMPLATES[spec.cat];
  const ids = categoryIdsFor(market.slug);
  return {
    id: `${market.slug}-${slugify(spec.ville)}-${slugify(spec.quartier)}`,
    title: `${tpl.noun} — ${spec.quartier}`,
    subtitle: `${tpl.subtitle} à ${spec.ville}`,
    info: tpl.info,
    price: spec.price.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' '),
    price_num: spec.price,
    price_unit: tpl.unit,
    img: tpl.img,
    alt: `${tpl.noun} ${spec.quartier}, ${spec.ville}`,
    images: [tpl.img, tpl.second],
    description: tpl.description(spec.ville, spec.quartier),
    capacity: tpl.capacity,
    category: ids[spec.cat],
    market: market.code,
    pays: market.pays,
    ville: spec.ville,
    quartier: spec.quartier,
    chambres: tpl.chambres,
    douches: tpl.douches,
    disponible: spec.disponible !== false,
    date_dispo: '2026-10-01',
    conditions: tpl.conditions,
  };
}

// 7 chambres par marché : 4 catégories couvertes, 2 à 3 villes réelles.
const ROOM_SPECS: Record<(typeof NEW_MARKET_CODES)[number], RoomSpec[]> = {
  SN: [
    { ville: 'Dakar', quartier: 'Ouakam', cat: 'appartements', price: 450000 },
    { ville: 'Dakar', quartier: 'Plateau', cat: 'appartements', price: 380000 },
    { ville: 'Dakar', quartier: 'Almadies', cat: 'chambres-premium', price: 300000 },
    { ville: 'Dakar', quartier: 'Yoff', cat: 'chambres-moins-cheres', price: 150000 },
    { ville: 'Saly', quartier: 'Portudal', cat: 'chambres-moins-cheres', price: 90000 },
    { ville: 'Dakar', quartier: 'Médina', cat: 'hotels', price: 85000, disponible: false },
    { ville: 'Saint-Louis', quartier: 'Guérette', cat: 'appartements', price: 220000 },
  ],
  TG: [
    { ville: 'Lomé', quartier: 'Bè', cat: 'appartements', price: 300000 },
    { ville: 'Lomé', quartier: 'Tokoin', cat: 'appartements', price: 250000 },
    { ville: 'Lomé', quartier: 'Adidogomé', cat: 'chambres-premium', price: 180000 },
    { ville: 'Lomé', quartier: 'Hédzranawo', cat: 'chambres-moins-cheres', price: 100000 },
    { ville: 'Kpalimé', quartier: 'Centre', cat: 'chambres-moins-cheres', price: 60000 },
    { ville: 'Lomé', quartier: 'Baguida', cat: 'hotels', price: 60000 },
    { ville: 'Aného', quartier: 'Centre', cat: 'appartements', price: 150000 },
  ],
  CM: [
    { ville: 'Douala', quartier: 'Akwa', cat: 'appartements', price: 400000 },
    { ville: 'Yaoundé', quartier: 'Mvan', cat: 'appartements', price: 350000 },
    { ville: 'Douala', quartier: 'Bonapriso', cat: 'chambres-premium', price: 300000 },
    { ville: 'Yaoundé', quartier: 'Nsam', cat: 'chambres-moins-cheres', price: 120000 },
    { ville: 'Kribi', quartier: 'Grand Village', cat: 'chambres-moins-cheres', price: 100000 },
    { ville: 'Douala', quartier: 'Bonanjo', cat: 'hotels', price: 90000 },
    { ville: 'Yaoundé', quartier: 'Bastos', cat: 'appartements', price: 550000, disponible: false },
  ],
  BF: [
    { ville: 'Ouagadougou', quartier: 'Ouaga 2000', cat: 'appartements', price: 350000 },
    { ville: 'Ouagadougou', quartier: 'Zone du Bois', cat: 'appartements', price: 250000 },
    { ville: 'Ouagadougou', quartier: 'Karpala', cat: 'chambres-premium', price: 200000 },
    { ville: 'Ouagadougou', quartier: 'Gounghin', cat: 'chambres-moins-cheres', price: 100000 },
    { ville: 'Bobo-Dioulasso', quartier: 'Accare', cat: 'chambres-moins-cheres', price: 75000 },
    { ville: 'Ouagadougou', quartier: 'Secteur 4', cat: 'hotels', price: 70000 },
    { ville: 'Bobo-Dioulasso', quartier: 'Sabou', cat: 'appartements', price: 180000 },
  ],
  CG: [
    { ville: 'Brazzaville', quartier: 'Bacongo', cat: 'appartements', price: 300000 },
    { ville: 'Brazzaville', quartier: 'Poto-Poto', cat: 'appartements', price: 250000 },
    { ville: 'Brazzaville', quartier: 'Talangaï', cat: 'chambres-premium', price: 200000 },
    { ville: 'Brazzaville', quartier: 'Moungali', cat: 'chambres-moins-cheres', price: 120000 },
    { ville: 'Pointe-Noire', quartier: 'Loandjili', cat: 'chambres-moins-cheres', price: 100000 },
    { ville: 'Brazzaville', quartier: 'Maxwell', cat: 'hotels', price: 80000 },
    { ville: 'Pointe-Noire', quartier: 'Tié-Tié', cat: 'appartements', price: 280000 },
  ],
  GA: [
    { ville: 'Libreville', quartier: 'Batterie IV', cat: 'appartements', price: 400000 },
    { ville: 'Libreville', quartier: 'Louis', cat: 'appartements', price: 350000 },
    { ville: 'Libreville', quartier: 'Nombakélé', cat: 'chambres-premium', price: 280000 },
    { ville: 'Libreville', quartier: 'Owendo', cat: 'chambres-moins-cheres', price: 150000 },
    { ville: 'Port-Gentil', quartier: 'Grand Village', cat: 'chambres-moins-cheres', price: 120000 },
    { ville: 'Libreville', quartier: 'Les Orangers', cat: 'hotels', price: 90000 },
    { ville: 'Port-Gentil', quartier: 'Centre', cat: 'appartements', price: 300000, disponible: false },
  ],
  GN: [
    { ville: 'Conakry', quartier: 'Kipé', cat: 'appartements', price: 450000 },
    { ville: 'Conakry', quartier: 'Ratoma', cat: 'appartements', price: 350000 },
    { ville: 'Conakry', quartier: 'Camayenne', cat: 'chambres-premium', price: 300000 },
    { ville: 'Conakry', quartier: 'Koloma', cat: 'chambres-moins-cheres', price: 180000 },
    { ville: 'Labé', quartier: 'Centre', cat: 'chambres-moins-cheres', price: 120000 },
    { ville: 'Conakry', quartier: 'Kaloum', cat: 'hotels', price: 100000 },
    { ville: 'Kindia', quartier: 'Centre', cat: 'appartements', price: 250000 },
  ],
  ML: [
    { ville: 'Bamako', quartier: 'Hippodrome', cat: 'appartements', price: 400000 },
    { ville: 'Bamako', quartier: 'ACI 2000', cat: 'appartements', price: 350000 },
    { ville: 'Bamako', quartier: 'Badalabougou', cat: 'chambres-premium', price: 280000 },
    { ville: 'Bamako', quartier: 'Sénou', cat: 'chambres-moins-cheres', price: 120000 },
    { ville: 'Ségou', quartier: 'Sévaré', cat: 'chambres-moins-cheres', price: 90000 },
    { ville: 'Bamako', quartier: 'Plateau', cat: 'hotels', price: 80000 },
    { ville: 'Sikasso', quartier: 'Centre', cat: 'appartements', price: 200000 },
  ],
  NE: [
    { ville: 'Niamey', quartier: 'Goudji', cat: 'appartements', price: 350000 },
    { ville: 'Niamey', quartier: 'Kalley Centre', cat: 'appartements', price: 300000 },
    { ville: 'Niamey', quartier: 'Farcha', cat: 'chambres-premium', price: 220000 },
    { ville: 'Niamey', quartier: 'Yantala', cat: 'chambres-moins-cheres', price: 120000 },
    { ville: 'Zinder', quartier: 'Centre', cat: 'chambres-moins-cheres', price: 90000 },
    { ville: 'Niamey', quartier: 'Aube', cat: 'hotels', price: 75000 },
    { ville: 'Maradi', quartier: 'Centre', cat: 'appartements', price: 200000 },
  ],
  CD: [
    { ville: 'Kinshasa', quartier: 'Gombe', cat: 'appartements', price: 1200000 },
    { ville: 'Kinshasa', quartier: 'Limete', cat: 'appartements', price: 800000 },
    { ville: 'Kinshasa', quartier: 'Ngaliema', cat: 'chambres-premium', price: 700000 },
    { ville: 'Kinshasa', quartier: 'Kintambo', cat: 'chambres-moins-cheres', price: 350000 },
    { ville: 'Lubumbashi', quartier: 'Kampemba', cat: 'chambres-moins-cheres', price: 300000 },
    { ville: 'Kinshasa', quartier: 'Bandalungwa', cat: 'hotels', price: 250000 },
    { ville: 'Lubumbashi', quartier: 'Centre', cat: 'appartements', price: 600000, disponible: false },
  ],
};

export const newMarketRooms: RoomSeed[] = NEW_MARKET_CODES.flatMap((code) =>
  ROOM_SPECS[code].map((spec) => buildRoom(code, spec)),
);

// ── Événements ───────────────────────────────────────────────────────────

const EVENT_IMG = {
  ville: '/images/1.jpg',
  nature: '/images/tori.jpg',
  culture: '/images/ouidah.jpg',
  interieur: '/images/pexels-artbovich-7214173.jpg',
  plage: '/images/pexels-donaldtong94-189333.jpg',
} as const;

const NEW_EVENTS: EventSeed[] = [
  { id: 'ev-sn-dakar-musique', market: 'SN', city: 'Dakar', title: 'Festival de musique de Dakar', description: 'Scènes gratuites à Dakar, du mbalax au jazz, jusqu’à minuit.', inDays: 12, img: EVENT_IMG.ville, alt: 'Festival de musique à Dakar' },
  { id: 'ev-sn-dakar-cinema', market: 'SN', city: 'Dakar', title: 'Cinéma en plein air au Plateau', description: 'Projections de films d’auteur africains en plein air, entrée libre.', inDays: 30, img: EVENT_IMG.interieur, alt: 'Cinéma en plein air à Dakar' },
  { id: 'ev-sn-saint-louis-jazz', market: 'SN', city: 'Saint-Louis', title: 'Jazz à Saint-Louis', description: 'Trois soirées de jazz sur les quais de la Senaga, rencontres incluses.', inDays: 45, img: EVENT_IMG.culture, alt: 'Jazz à Saint-Louis' },
  { id: 'ev-sn-saly-artisanat', market: 'SN', city: 'Saly', title: 'Salon artisanal de Saly', description: 'Artisanat, cuisine locale et musique sur la plage de Saly.', inDays: 20, img: EVENT_IMG.plage, alt: 'Salon artisanal à Saly' },
  { id: 'ev-sn-dakar-rallye', market: 'SN', city: 'Dakar', title: 'Village des spectateurs du rallye', description: 'Animations, concerts et stands ouverts au public pendant le rallye.', inDays: 60, img: EVENT_IMG.ville, alt: 'Village des spectateurs à Dakar' },

  { id: 'ev-tg-lome-carnaval', market: 'TG', city: 'Lomé', title: 'Carnaval de Lomé', description: 'Déguisements, tambours et chars décorés défilent du marché à la plage.', inDays: 18, img: EVENT_IMG.ville, alt: 'Carnaval à Lomé' },
  { id: 'ev-tg-lome-musique', market: 'TG', city: 'Lomé', title: 'Rhythms & Arts Festival', description: 'Concerts et arts urbains sur trois scènes du centre de Lomé.', inDays: 35, img: EVENT_IMG.culture, alt: 'Festival de musique à Lomé' },
  { id: 'ev-tg-lome-palmes', market: 'TG', city: 'Lomé', title: 'Fête des palmes', description: 'Défilés, danses traditionnelles et repas partagés dans la capitale.', inDays: 50, img: EVENT_IMG.interieur, alt: 'Fête des palmes à Lomé' },
  { id: 'ev-tg-kpalime-rando', market: 'TG', city: 'Kpalimé', title: 'Randonnée des chutes', description: 'Randonnée encadrée de 8 km entre forêt, chutes et points de vue.', inDays: 25, img: EVENT_IMG.nature, alt: 'Randonnée près de Kpalimé' },
  { id: 'ev-tg-anho-folklore', market: 'TG', city: 'Aného', title: 'Festival du folklore d’Aného', description: 'Danse, tambour et récits des villages du lagon, entrée gratuite.', inDays: 42, img: EVENT_IMG.plage, alt: 'Folklore à Aného' },

  { id: 'ev-cm-douala-cinema', market: 'CM', city: 'Douala', title: 'Festival du cinéma de Douala', description: 'Cinq soirées de projections et de rencontres avec les réalisateurs.', inDays: 14, img: EVENT_IMG.ville, alt: 'Cinéma à Douala' },
  { id: 'ev-cm-yaounde-musique', market: 'CM', city: 'Yaoundé', title: 'Fête de la musique à Yaoundé', description: 'Scènes gratuites à Bastos et Mvan, du makossa au hip-hop.', inDays: 28, img: EVENT_IMG.interieur, alt: 'Fête de la musique à Yaoundé' },
  { id: 'ev-cm-kribi-arts', market: 'CM', city: 'Kribi', title: 'Festival des arts de Kribi', description: 'Arts vivants et expositions en bord de mer, entrée libre.', inDays: 38, img: EVENT_IMG.plage, alt: 'Festival des arts à Kribi' },
  { id: 'ev-cm-bafoussam-masques', market: 'CM', city: 'Bafoussam', title: 'Festival des masques des Grassfields', description: 'Compagnies de masques des royaumes des Hauts-Plateaux.', inDays: 52, img: EVENT_IMG.culture, alt: 'Masques à Bafoussam' },
  { id: 'ev-cm-douala-ngondo', market: 'CM', city: 'Douala', title: 'Ngondo à Douala', description: 'Cérémonie et fête des peuples sawa au bord du Wouri.', inDays: 62, img: EVENT_IMG.nature, alt: 'Ngondo à Douala' },

  { id: 'ev-bf-ouaga-cinema', market: 'BF', city: 'Ouagadougou', title: 'Cinéma en plein air de Ouagadougou', description: 'Projections de longs métrages africains sur le parvis du cinéma.', inDays: 20, img: EVENT_IMG.interieur, alt: 'Cinéma à Ouagadougou' },
  { id: 'ev-bf-ouaga-musique', market: 'BF', city: 'Ouagadougou', title: 'Festival de musique de Ouagadougou', description: 'Concerts de fanfares, djembé et musiques modernes.', inDays: 34, img: EVENT_IMG.ville, alt: 'Festival de musique à Ouagadougou' },
  { id: 'ev-bf-bobo-artisanat', market: 'BF', city: 'Bobo-Dioulasso', title: 'Salon artisanal de Bobo', description: 'Trois jours d’exposition et de démonstrations au marché central.', inDays: 46, img: EVENT_IMG.culture, alt: 'Artisanat à Bobo-Dioulasso' },
  { id: 'ev-bf-gorom-marche', market: 'BF', city: 'Gorom-Gorom', title: 'Marché du jeudi de Gorom-Gorom', description: 'Grand marché touareg : artisanat, épices et bétail.', inDays: 10, img: EVENT_IMG.nature, alt: 'Marché de Gorom-Gorom' },
  { id: 'ev-bf-ouaga-foire', market: 'BF', city: 'Ouagadougou', title: 'Foire artisanale de Ouagadougou', description: 'Artisans de tout le pays réunis sur le site du salon.', inDays: 58, img: EVENT_IMG.interieur, alt: 'Foire artisanale à Ouagadougou' },

  { id: 'ev-cg-brazza-musique', market: 'CG', city: 'Brazzaville', title: 'Festival de musique de Brazzaville', description: 'Concerts au parc de la Piscine, du rumba congolaise au gospel.', inDays: 15, img: EVENT_IMG.ville, alt: 'Festival de musique à Brazzaville' },
  { id: 'ev-cg-brazza-theatre', market: 'CG', city: 'Brazzaville', title: 'Journées du théâtre', description: 'Pièces et lectures dans les salles et les cours du centre.', inDays: 32, img: EVENT_IMG.culture, alt: 'Théâtre à Brazzaville' },
  { id: 'ev-cg-pointenoire-masques', market: 'CG', city: 'Pointe-Noire', title: 'Festival des masques de Pointe-Noire', description: 'Masques, danses et percussion du Kouilou sur la place du marché.', inDays: 44, img: EVENT_IMG.nature, alt: 'Masques à Pointe-Noire' },
  { id: 'ev-cg-brazza-cinema', market: 'CG', city: 'Brazzaville', title: 'Cinéma congolais en plein air', description: 'Projections de courts et longs métrages congolais, entrée libre.', inDays: 26, img: EVENT_IMG.interieur, alt: 'Cinéma à Brazzaville' },
  { id: 'ev-cg-dolissie-recoltes', market: 'CG', city: 'Dolissie', title: 'Fête des récoltes de Dolissie', description: 'Danses, chants de récolte et repas partagés en saison sèche.', inDays: 56, img: EVENT_IMG.nature, alt: 'Fête des récoltes à Dolissie' },

  { id: 'ev-ga-libreville-musique', market: 'GA', city: 'Libreville', title: 'Festival de musique de Libreville', description: 'Concerts sur la digue, du n’goma aux musiques actuelles.', inDays: 16, img: EVENT_IMG.ville, alt: 'Festival de musique à Libreville' },
  { id: 'ev-ga-libreville-cinema', market: 'GA', city: 'Libreville', title: 'Soirée cinéma à Batterie IV', description: 'Projections en plein air suivies de débats avec les réalisateurs.', inDays: 29, img: EVENT_IMG.interieur, alt: 'Cinéma à Libreville' },
  { id: 'ev-ga-portgentil-festival', market: 'GA', city: 'Port-Gentil', title: 'Festival de Port-Gentil', description: 'Trois jours de concerts, de sport et de cuisine du littoral.', inDays: 41, img: EVENT_IMG.plage, alt: 'Festival à Port-Gentil' },
  { id: 'ev-ga-franceville-culture', market: 'GA', city: 'Franceville', title: 'Journées culturelles de Franceville', description: 'Danses punu et nkomi, artisanat et exposition photo.', inDays: 53, img: EVENT_IMG.culture, alt: 'Journées culturelles à Franceville' },
  { id: 'ev-ga-libreville-livre', market: 'GA', city: 'Libreville', title: 'Salon du livre de Libreville', description: 'Auteurs, ateliers d’écriture et dédicaces à la Cité des arts.', inDays: 24, img: EVENT_IMG.culture, alt: 'Salon du livre à Libreville' },

  { id: 'ev-gn-conakry-musique', market: 'GN', city: 'Conakry', title: 'Festival de musique de Conakry', description: 'Concerts au stade et aux places de la ville, styles guinéens réunis.', inDays: 13, img: EVENT_IMG.ville, alt: 'Festival de musique à Conakry' },
  { id: 'ev-gn-conakry-cinema', market: 'GN', city: 'Conakry', title: 'Cinéma en plein air à Kaloum', description: 'Projections de films guinéens et africains, entrée libre.', inDays: 31, img: EVENT_IMG.interieur, alt: 'Cinéma à Conakry' },
  { id: 'ev-gn-labe-fouta', market: 'GN', city: 'Labé', title: 'Festival du Fouta Djallon', description: 'Récits, musique kora et randonnées dans les montagnes du Fouta.', inDays: 43, img: EVENT_IMG.nature, alt: 'Festival à Labé' },
  { id: 'ev-gn-kindia-culture', market: 'GN', city: 'Kindia', title: 'Journées culturelles de Kindia', description: 'Danses, artisanat et compétitions de cascades en région.', inDays: 54, img: EVENT_IMG.nature, alt: 'Journées culturelles à Kindia' },
  { id: 'ev-gn-conakry-gastro', market: 'GN', city: 'Conakry', title: 'Festival gastronomique de Conakry', description: 'Spécialités régionales, ateliers et dégustations sur le front de mer.', inDays: 22, img: EVENT_IMG.plage, alt: 'Festival gastronomique à Conakry' },

  { id: 'ev-ml-bamako-musique', market: 'ML', city: 'Bamako', title: 'Festival de musique de Bamako', description: 'Concerts de griots et de groupes contemporains sur deux scènes.', inDays: 17, img: EVENT_IMG.ville, alt: 'Festival de musique à Bamako' },
  { id: 'ev-ml-bamako-cinema', market: 'ML', city: 'Bamako', title: 'Écrans de Bamako', description: 'Projections et masterclasses de cinéma d’auteur africain.', inDays: 36, img: EVENT_IMG.interieur, alt: 'Cinéma à Bamako' },
  { id: 'ev-ml-mopti-festival', market: 'ML', city: 'Mopti', title: 'Festival de Mopti', description: 'Musique, artisanat et embarcations décorées sur le Niger.', inDays: 47, img: EVENT_IMG.nature, alt: 'Festival à Mopti' },
  { id: 'ev-ml-segou-culture', market: 'ML', city: 'Ségou', title: 'Festival culturel de Ségou', description: 'Danse, marionnettes et marché de l’artisanat à Ségou-Koro.', inDays: 27, img: EVENT_IMG.culture, alt: 'Festival culturel à Ségou' },
  { id: 'ev-ml-djenne-fete', market: 'ML', city: 'Djenné', title: 'Fête de Djenné', description: 'Cortèges, musique et repas de partage au pied de la grande mosquée.', inDays: 57, img: EVENT_IMG.culture, alt: 'Fête à Djenné' },

  { id: 'ev-ne-niamey-culture', market: 'NE', city: 'Niamey', title: 'Festival de Niamey', description: 'Arts vivants et expositions dans les lieux culturels de la capitale.', inDays: 19, img: EVENT_IMG.ville, alt: 'Festival à Niamey' },
  { id: 'ev-ne-niamey-cinema', market: 'NE', city: 'Niamey', title: 'Cinéma en plein air à Niamey', description: 'Projections de films sahéliens sur la place du grand marché.', inDays: 33, img: EVENT_IMG.interieur, alt: 'Cinéma à Niamey' },
  { id: 'ev-ne-agadez-carnaval', market: 'NE', city: 'Agadez', title: 'Carnaval d’Agadez', description: 'Défilés de tissus, musique touarègue et artisanat de la médina.', inDays: 48, img: EVENT_IMG.nature, alt: 'Carnaval à Agadez' },
  { id: 'ev-ne-zinder-culture', market: 'NE', city: 'Zinder', title: 'Journées culturelles de Zinder', description: 'Danses, récits et cuisine traditionnelle du sud-est nigérien.', inDays: 23, img: EVENT_IMG.culture, alt: 'Journées culturelles à Zinder' },
  { id: 'ev-ne-niamey-musique', market: 'NE', city: 'Niamey', title: 'Nuits musicales de la Médina', description: 'Concerts en soirée, guitare traditionnelle et rythmes de la région.', inDays: 59, img: EVENT_IMG.ville, alt: 'Nuits musicales à Niamey' },

  { id: 'ev-cd-kinshasa-musique', market: 'CD', city: 'Kinshasa', title: 'Festival de musique de Kinshasa', description: 'Concerts de rumba et de soukous sur trois scènes de la Gombe.', inDays: 11, img: EVENT_IMG.ville, alt: 'Festival de musique à Kinshasa' },
  { id: 'ev-cd-kinshasa-cinema', market: 'CD', city: 'Kinshasa', title: 'Cinéma congolais à Kinshasa', description: 'Projections de longs métrages et rencontres avec les équipes.', inDays: 30, img: EVENT_IMG.interieur, alt: 'Cinéma à Kinshasa' },
  { id: 'ev-cd-lubumbashi-festival', market: 'CD', city: 'Lubumbashi', title: 'Festival de Lubumbashi', description: 'Musique, théâtre et artisanat du Haut-Katanga.', inDays: 40, img: EVENT_IMG.culture, alt: 'Festival à Lubumbashi' },
  { id: 'ev-cd-goma-lac', market: 'CD', city: 'Goma', title: 'Festival du Lac Kivu', description: 'Concerts et promenades au bord du lac, vue sur le Nyiragongo.', inDays: 50, img: EVENT_IMG.nature, alt: 'Festival au Lac Kivu' },
  { id: 'ev-cd-kinshasa-art', market: 'CD', city: 'Kinshasa', title: 'Salon d’art de Kinshasa', description: 'Peinture, sculpture et photographie des artistes congolais.', inDays: 63, img: EVENT_IMG.culture, alt: 'Salon d’art à Kinshasa' },
];

export const newMarketEvents = NEW_EVENTS;

// ── Destinations tourisme ────────────────────────────────────────────────

const TOURISM_IMG = {
  ville: '/images/pexels-artbovich-7214173.jpg',
  nature: '/images/tori.jpg',
  culture: '/images/ouidah.jpg',
  interieur: '/images/pexels-artbovich-6782567.jpg',
  plage: '/images/pexels-fotoaibe-1571460.jpg',
  hotel: '/images/pexels-artbovich-7045712.jpg',
} as const;

const NEW_TOURISM: TourismSeed[] = [
  { id: 'des-sn-goree', market: 'SN', city: 'Dakar', title: 'Île de Gorée', description: 'Île historique classée à l’UNESCO, maisons colorées et mémoire de la traite.', img: TOURISM_IMG.culture, alt: 'Île de Gorée' },
  { id: 'des-sn-lac-rose', market: 'SN', city: 'Rufisque', title: 'Lac Rose', description: 'Lac aux eaux roses et salines à une heure de Dakar.', img: TOURISM_IMG.plage, alt: 'Lac Rose' },
  { id: 'des-sn-saint-louis', market: 'SN', city: 'Saint-Louis', title: 'Saint-Louis', description: 'Ancienne capitale coloniale sur une île, classée à l’UNESCO.', img: TOURISM_IMG.ville, alt: 'Saint-Louis' },
  { id: 'des-sn-saly', market: 'SN', city: 'Saly', title: 'Saly', description: 'Station balnéaire de la côte atlantique : plages et golf.', img: TOURISM_IMG.plage, alt: 'Plage de Saly' },
  { id: 'des-sn-popenguine', market: 'SN', city: 'Popenguine', title: 'Popenguine', description: 'Sanctuaire, plage tranquille et réserve naturelle du Nord.', img: TOURISM_IMG.nature, alt: 'Popenguine' },
  { id: 'des-sn-ziguinchor', market: 'SN', city: 'Ziguinchor', title: 'Ziguinchor', description: 'Capitale de la Casamance : marché, mangroves et îles du Delta.', img: TOURISM_IMG.hotel, alt: 'Ziguinchor' },
  { id: 'des-sn-mbour', market: 'SN', city: 'Mbour', title: 'Mbour', description: 'Grand port de pêche et plages de sable fin.', img: TOURISM_IMG.plage, alt: 'Mbour' },

  { id: 'des-tg-lome', market: 'TG', city: 'Lomé', title: 'Lomé', description: 'Capitale sur la lagune : grand marché, Quartier allemand et front de mer.', img: TOURISM_IMG.ville, alt: 'Lomé' },
  { id: 'des-tg-kpalime', market: 'TG', city: 'Kpalimé', title: 'Kpalimé', description: 'Ville des chutes et de la forêt, randonnées dans les montagnes de l’ouest.', img: TOURISM_IMG.nature, alt: 'Kpalimé' },
  { id: 'des-tg-anho', market: 'TG', city: 'Aného', title: 'Aného', description: 'Ancienne capitale sur le lagon : maisons coloniales et plages.', img: TOURISM_IMG.plage, alt: 'Aného' },
  { id: 'des-tg-togoville', market: 'TG', city: 'Togoville', title: 'Togoville', description: 'Ville historique du lagon, berceau du royaume des Ewe.', img: TOURISM_IMG.culture, alt: 'Togoville' },
  { id: 'des-tg-kara', market: 'TG', city: 'Kara', title: 'Kara', description: 'Plateaux du nord, culture kabyè et randonnées.', img: TOURISM_IMG.nature, alt: 'Kara' },
  { id: 'des-tg-koutammakou', market: 'TG', city: 'Koutammakou', title: 'Koutammakou', description: 'Paysage des toumbas, cases-torets des Batammariba, classé UNESCO.', img: TOURISM_IMG.culture, alt: 'Koutammakou' },
  { id: 'des-tg-bassar', market: 'TG', city: 'Bassar', title: 'Bassar', description: 'Pays des forgerons et de la danse du sabre.', img: TOURISM_IMG.hotel, alt: 'Bassar' },

  { id: 'des-cm-douala', market: 'CM', city: 'Douala', title: 'Douala', description: 'Capitale économique : Bonanjo, marché du Wouri et vie nocturne.', img: TOURISM_IMG.ville, alt: 'Douala' },
  { id: 'des-cm-yaounde', market: 'CM', city: 'Yaoundé', title: 'Yaoundé', description: 'Capitale politique sur sept collines, musées et marchés.', img: TOURISM_IMG.interieur, alt: 'Yaoundé' },
  { id: 'des-cm-kribi', market: 'CM', city: 'Kribi', title: 'Kribi', description: 'Plages de sable fin et chutes de la Lobé qui se jettent dans la mer.', img: TOURISM_IMG.plage, alt: 'Kribi' },
  { id: 'des-cm-bafoussam', market: 'CM', city: 'Bafoussam', title: 'Bafoussam', description: 'Capitale des Hauts-Plateaux : marché des Batie et royautés bamiléké.', img: TOURISM_IMG.nature, alt: 'Bafoussam' },
  { id: 'des-cm-limbe', market: 'CM', city: 'Limbe', title: 'Limbe', description: 'Ville volcanique : plages de sable noir et parc zoologique.', img: TOURISM_IMG.plage, alt: 'Limbe' },
  { id: 'des-cm-bamenda', market: 'CM', city: 'Bamenda', title: 'Bamenda', description: 'Ville des Ring Road, vallées et chefferies des Bamileke.', img: TOURISM_IMG.nature, alt: 'Bamenda' },
  { id: 'des-cm-foumban', market: 'CM', city: 'Foumban', title: 'Foumban', description: 'Capitale du royaume Bamoun : palais royal et artisanat d’art.', img: TOURISM_IMG.culture, alt: 'Foumban' },

  { id: 'des-bf-ouagadougou', market: 'BF', city: 'Ouagadougou', title: 'Ouagadougou', description: 'Capitale des artisans : Grande Mosquée, marché Rood Woko et zoma.', img: TOURISM_IMG.ville, alt: 'Ouagadougou' },
  { id: 'des-bf-bobo', market: 'BF', city: 'Bobo-Dioulasso', title: 'Bobo-Dioulasso', description: 'Deuxième ville du pays : grande mosquée en banco et marché central.', img: TOURISM_IMG.culture, alt: 'Bobo-Dioulasso' },
  { id: 'des-bf-gorom', market: 'BF', city: 'Gorom-Gorom', title: 'Gorom-Gorom', description: 'Marché du jeudi touareg en plein cœur du Sahel.', img: TOURISM_IMG.nature, alt: 'Gorom-Gorom' },
  { id: 'des-bf-banfora', market: 'BF', city: 'Banfora', title: 'Banfora', description: 'Portes des cascades de Karfiguéla et des plantations de canne.', img: TOURISM_IMG.nature, alt: 'Banfora' },
  { id: 'des-bf-sindou', market: 'BF', city: 'Sindou', title: 'Pics de Sindou', description: 'Empreintes de roches sculptées par l’érosion, au pays kassena.', img: TOURISM_IMG.nature, alt: 'Pics de Sindou' },
  { id: 'des-bf-loropeni', market: 'BF', city: 'Loropéni', title: 'Loropéni', description: 'Ruines d’une forteresse en terre, classées au patrimoine mondial.', img: TOURISM_IMG.culture, alt: 'Loropéni' },
  { id: 'des-bf-touba', market: 'BF', city: 'Touba', title: 'Touba', description: 'Ville des plumes : cérémonies moro ba du Pays moa.', img: TOURISM_IMG.hotel, alt: 'Touba' },

  { id: 'des-cg-brazzaville', market: 'CG', city: 'Brazzaville', title: 'Brazzaville', description: 'Basilique Sainte-Anne, Plateau des 15 ans et marchés de Bacongo.', img: TOURISM_IMG.ville, alt: 'Brazzaville' },
  { id: 'des-cg-pointenoire', market: 'CG', city: 'Pointe-Noire', title: 'Pointe-Noire', description: 'Capitale pétrolière : plage de La Pointe et marchés.', img: TOURISM_IMG.plage, alt: 'Pointe-Noire' },
  { id: 'des-cg-ouesso', market: 'CG', city: 'Ouesso', title: 'Ouesso', description: 'Porte du parc national de Nouabalé-Ndoki, forêt primaire.', img: TOURISM_IMG.nature, alt: 'Ouesso' },
  { id: 'des-cg-dolissie', market: 'CG', city: 'Dolissie', title: 'Dolissie', description: 'Ville du Niari, portes des chutes et des plateaux.', img: TOURISM_IMG.nature, alt: 'Dolissie' },
  { id: 'des-cg-sibiti', market: 'CG', city: 'Sibiti', title: 'Sibiti', description: 'Ville des Lékoumou, case à palabres et chutes de Kondoro.', img: TOURISM_IMG.culture, alt: 'Sibiti' },
  { id: 'des-cg-impfondo', market: 'CG', city: 'Impfondo', title: 'Impfondo', description: 'Ville de l’Alima : pirogues, forêt et faune du nord-est.', img: TOURISM_IMG.nature, alt: 'Impfondo' },
  { id: 'des-cg-oyo', market: 'CG', city: 'Oyo', title: 'Oyo', description: 'Plateau du centre, rivières et bains de pierre.', img: TOURISM_IMG.hotel, alt: 'Oyo' },

  { id: 'des-ga-libreville', market: 'GA', city: 'Libreville', title: 'Libreville', description: 'Capitale sur l’estuaire : batterie IV, aquarium et marchés.', img: TOURISM_IMG.ville, alt: 'Libreville' },
  { id: 'des-ga-pongara', market: 'GA', city: 'Libreville', title: 'Réserve de Pongara', description: 'Forêt mangrove et plages à une heure de la capitale.', img: TOURISM_IMG.plage, alt: 'Réserve de Pongara' },
  { id: 'des-ga-portgentil', market: 'GA', city: 'Port-Gentil', title: 'Port-Gentil', description: 'Îles et plages de la province de l’Ogooué-Maritime.', img: TOURISM_IMG.plage, alt: 'Port-Gentil' },
  { id: 'des-ga-lope', market: 'GA', city: 'Franceville', title: 'Parc de la Lopé', description: 'Savanes et forêts du centre du Gabon, classées UNESCO.', img: TOURISM_IMG.nature, alt: 'Parc de la Lopé' },
  { id: 'des-ga-lambarene', market: 'GA', city: 'Lambaréné', title: 'Lambaréné', description: 'Hôpital Albert Schweitzer et îles de l’Ogooué.', img: TOURISM_IMG.culture, alt: 'Lambaréné' },
  { id: 'des-ga-koulamoutou', market: 'GA', city: 'Koulamoutou', title: 'Koulamoutou', description: 'Ville de l’Ogooué-Lolo : chutes deMboungou et randonnées.', img: TOURISM_IMG.nature, alt: 'Koulamoutou' },
  { id: 'des-ga-makokou', market: 'GA', city: 'Makokou', title: 'Makokou', description: 'Porte du parc national de l’Ivindo et chutes de Kongou.', img: TOURISM_IMG.nature, alt: 'Makokou' },

  { id: 'des-gn-conakry', market: 'GN', city: 'Conakry', title: 'Conakry', description: 'Péninsule de Kaloum : grand marché de Sandaka et front de mer.', img: TOURISM_IMG.ville, alt: 'Conakry' },
  { id: 'des-gn-iles-los', market: 'GN', city: 'Conakry', title: 'Îles de Los', description: 'Petites îles rocheuses à un braquet du continent.', img: TOURISM_IMG.plage, alt: 'Îles de Los' },
  { id: 'des-gn-labe', market: 'GN', city: 'Labé', title: 'Labé', description: 'Capitale du Fouta Djallon : montagnes, chutes et marchés de bétail.', img: TOURISM_IMG.nature, alt: 'Labé' },
  { id: 'des-gn-kindia', market: 'GN', city: 'Kindia', title: 'Kindia', description: 'Chutes de la Soumba et plantations de fruits du pays de la mangue.', img: TOURISM_IMG.nature, alt: 'Kindia' },
  { id: 'des-gn-dalaba', market: 'GN', city: 'Dalaba', title: 'Dalaba', description: 'Ville fraîche des montagnes du Fouta, bains et randonnées.', img: TOURISM_IMG.nature, alt: 'Dalaba' },
  { id: 'des-gn-nzerekore', market: 'GN', city: 'Nzérékoré', title: 'Nzérékoré', description: 'Ville du sud-est : forêts de la Guinée forestière.', img: TOURISM_IMG.hotel, alt: 'Nzérékoré' },
  { id: 'des-gn-kankan', market: 'GN', city: 'Kankan', title: 'Kankan', description: 'Ville mandingue : grande mosquée et marché du bétail.', img: TOURISM_IMG.culture, alt: 'Kankan' },

  { id: 'des-ml-bamako', market: 'ML', city: 'Bamako', title: 'Bamako', description: 'Capitale sur le Niger : grande mosquée, musée national et marché de Medina.', img: TOURISM_IMG.ville, alt: 'Bamako' },
  { id: 'des-ml-mont-bamako', market: 'ML', city: 'Bamako', title: 'Mont Bamako', description: 'Promontoire dominant la ville, vue panoramique sur le fleuve.', img: TOURISM_IMG.nature, alt: 'Mont Bamako' },
  { id: 'des-ml-segou', market: 'ML', city: 'Ségou', title: 'Ségou', description: 'Ancienne capitale bambara : artisanat, Bognokoli et bords du Niger.', img: TOURISM_IMG.culture, alt: 'Ségou' },
  { id: 'des-ml-mopti', market: 'ML', city: 'Mopti', title: 'Mopti', description: 'Port fluvial du Niger : embarcations et grand marché.', img: TOURISM_IMG.nature, alt: 'Mopti' },
  { id: 'des-ml-djenne', market: 'ML', city: 'Djenné', title: 'Djenné', description: 'Cité en banco et grande mosquée, classée UNESCO.', img: TOURISM_IMG.culture, alt: 'Djenné' },
  { id: 'des-ml-tombouctou', market: 'ML', city: 'Tombouctou', title: 'Tombouctou', description: 'Cité historique des manuscrits et des mosquées de sable.', img: TOURISM_IMG.culture, alt: 'Tombouctou' },
  { id: 'des-ml-sikasso', market: 'ML', city: 'Sikasso', title: 'Sikasso', description: 'Ville des marchés du sud : Délisi et cascades des environs.', img: TOURISM_IMG.hotel, alt: 'Sikasso' },

  { id: 'des-ne-niamey', market: 'NE', city: 'Niamey', title: 'Niamey', description: 'Capitale sur le Niger : grande mosquée, marché et île du hippopotame.', img: TOURISM_IMG.ville, alt: 'Niamey' },
  { id: 'des-ne-agadez', market: 'NE', city: 'Agadez', title: 'Agadez', description: 'Cité caravanière de l’Aïr, médina de banco classée UNESCO.', img: TOURISM_IMG.culture, alt: 'Agadez' },
  { id: 'des-ne-zinder', market: 'NE', city: 'Zinder', title: 'Zinder', description: 'Ancienne capitale : palais du Sultan et grand marché.', img: TOURISM_IMG.culture, alt: 'Zinder' },
  { id: 'des-ne-maradi', market: 'NE', city: 'Maradi', title: 'Maradi', description: 'Ville commerçante du sud, marché du bétail et dombés.', img: TOURISM_IMG.hotel, alt: 'Maradi' },
  { id: 'des-ne-tillaberi', market: 'NE', city: 'Tillabéri', title: 'Tillabéri', description: 'Rives du Niger et portes du parc W.', img: TOURISM_IMG.nature, alt: 'Tillabéri' },
  { id: 'des-ne-tahoua', market: 'NE', city: 'Tahoua', title: 'Tahoua', description: 'Ville des Touaregs Igoudajen et marchés du désert.', img: TOURISM_IMG.nature, alt: 'Tahoua' },
  { id: 'des-ne-diffa', market: 'NE', city: 'Diffa', title: 'Diffa', description: 'Ville de la vallée du Komadougou, rizières et dunes.', img: TOURISM_IMG.nature, alt: 'Diffa' },

  { id: 'des-cd-kinshasa', market: 'CD', city: 'Kinshasa', title: 'Kinshasa', description: 'Mégalopole sur le Congo : Gombe, marchés de Ngaba et corniche.', img: TOURISM_IMG.ville, alt: 'Kinshasa' },
  { id: 'des-cd-goma', market: 'CD', city: 'Goma', title: 'Goma', description: 'Lac Kivu, sable noir volcanique et vue sur le Nyiragongo.', img: TOURISM_IMG.nature, alt: 'Goma' },
  { id: 'des-cd-lubumbashi', market: 'CD', city: 'Lubumbashi', title: 'Lubumbashi', description: 'Capitale du Haut-Katanga : mines, musées et kifumbu.', img: TOURISM_IMG.hotel, alt: 'Lubumbashi' },
  { id: 'des-cd-kisangani', market: 'CD', city: 'Kisangani', title: 'Kisangani', description: 'Ville des chutes de Boyoma, sur l’Equateur.', img: TOURISM_IMG.nature, alt: 'Kisangani' },
  { id: 'des-cd-bukavu', market: 'CD', city: 'Bukavu', title: 'Bukavu', description: 'Jardin botanique de Kalembelembe et rive sud du lac Kivu.', img: TOURISM_IMG.nature, alt: 'Bukavu' },
  { id: 'des-cd-matadi', market: 'CD', city: 'Matadi', title: 'Matadi', description: 'Port du Congo : chutes de Livingstone et gorges de l’Inga.', img: TOURISM_IMG.plage, alt: 'Matadi' },
  { id: 'des-cd-kikwit', market: 'CD', city: 'Kikwit', title: 'Kikwit', description: 'Ville du Kwilu : culture, marchés et rivières.', img: TOURISM_IMG.culture, alt: 'Kikwit' },
];

export const newMarketTourism = NEW_TOURISM;
