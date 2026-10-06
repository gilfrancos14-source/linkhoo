import 'dotenv/config';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from './config/supabase';
import {
  newMarketCategories,
  newMarketEvents,
  newMarketRooms,
  newMarketTourism,
  type EventSeed,
  type TourismSeed,
} from './seedMarkets';

const defaultCategories = [
  { id: 'appartements-moins-chers', title: 'Appartements moins chers', img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Appartement lumineux au meilleur prix', market: 'BJ' },
  { id: 'appartements-premium', title: 'Appartements premium', img: '/images/pexels-donaldtong94-189333.jpg', alt: 'Appartement premium avec salon spacieux', market: 'BJ' },
  { id: 'villas-premium', title: 'Villas premium', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Villa premium avec jardin', market: 'BJ' },
  { id: 'hotel', title: 'Hôtel', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Suite hôtelière avec vue mer', market: 'BJ' },
  { id: 'ci-chambres-moins-chères', title: 'Chambres moins chères', img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Chambre simple et abordable', market: 'CI' },
  { id: 'ci-chambres-premium', title: 'Chambres premium', img: '/images/pexels-artbovich-6782567.jpg', alt: 'Chambre premium bien équipée', market: 'CI' },
  { id: 'ci-appartements', title: 'Appartements', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Appartement spacieux', market: 'CI' },
  { id: 'ci-hotel', title: 'Hôtel', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Suite hôtelière', market: 'CI' },
  // 10 marchés ouverts : exactement le modèle CI (seedMarkets.ts).
  ...newMarketCategories,
];

const defaultRooms = [
  {
    id: 'familial-quartier-des-arts', title: 'Familial — Quartier des arts', subtitle: 'Appartement spacieux idéal pour les familles',
    info: '68 m² · 2 chambres · Balcon', price: '660', price_num: 660, price_unit: '/ mois',
    img: '/images/pexels-artbovich-6782567.jpg', alt: 'Familial, Quartier des arts',
    images: ['/images/pexels-artbovich-6782567.jpg', '/images/pexels-artbovich-7045712.jpg'],
    description: 'Appartement familial lumineux situé au cœur du quartier des arts.', capacity: '4 personnes',
    category: 'appartements-moins-chers', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Quartier des arts',
    chambres: 2, douches: 1, disponible: true, date_dispo: '2026-09-15',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'jardin-front-de-mer', title: 'Jardin — Front de mer', subtitle: 'Maison avec jardin en bord de mer',
    info: '72 m² · 2 chambres · Jardin', price: '690', price_num: 690, price_unit: '/ mois',
    img: '/images/pexels-artbovich-7045712.jpg', alt: 'Jardin, Front de mer',
    images: ['/images/pexels-artbovich-7045712.jpg', '/images/pexels-artbovich-7214173.jpg'],
    description: 'Maison avec jardin privatif en bord de mer.', capacity: '4 personnes',
    category: 'appartements-premium', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Front de mer',
    chambres: 2, douches: 2, disponible: true, date_dispo: '2026-09-10',
    conditions: 'Caution : 2 mois de loyer, Durée minimale : 12 mois',
  },
  {
    id: 'lumineux-centre-ville', title: 'Lumineux — Centre-ville', subtitle: 'Appartement moderne en plein centre',
    info: '65 m² · 2 chambres · Balcon', price: '670', price_num: 670, price_unit: '/ mois',
    img: '/images/pexels-artbovich-7214173.jpg', alt: 'Lumineux, Centre-ville',
    images: ['/images/pexels-artbovich-7214173.jpg', '/images/pexels-artbovich-6782567.jpg'],
    description: 'Appartement lumineux au cœur de la ville.', capacity: '4 personnes',
    category: 'appartements-moins-chers', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Centre-ville',
    chambres: 2, douches: 1, disponible: true, date_dispo: '2026-09-20',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'vue-mer-corniche', title: 'Vue mer — Corniche', subtitle: 'Appartement avec vue panoramique',
    info: '70 m² · 2 chambres · Terrasse', price: '710', price_num: 710, price_unit: '/ mois',
    img: '/images/pexels-donaldtong94-189333.jpg', alt: 'Vue mer, Corniche',
    images: ['/images/pexels-donaldtong94-189333.jpg', '/images/pexels-artbovich-7045712.jpg'],
    description: 'Appartement premium sur la corniche avec vue panoramique.', capacity: '4 personnes',
    category: 'appartements-premium', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Corniche',
    chambres: 2, douches: 2, disponible: true, date_dispo: '2026-10-01',
    conditions: 'Caution : 2 mois de loyer, Durée minimale : 12 mois',
  },
  {
    id: 'calme-peripherie', title: 'Calme — Périphérie', subtitle: 'Appartement paisible en périphérie',
    info: '62 m² · 2 chambres · Parking', price: '640', price_num: 640, price_unit: '/ mois',
    img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Calme, Périphérie',
    images: ['/images/pexels-fotoaibe-1571460.jpg', '/images/pexels-artbovich-6283961.jpg'],
    description: 'Appartement calme en périphérie.', capacity: '4 personnes',
    category: 'appartements-moins-chers', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Périphérie',
    chambres: 2, douches: 1, disponible: false, date_dispo: '2026-12-01',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'suite-prestige-front-de-mer', title: 'Suite Prestige — Front de mer', subtitle: 'Suite luxe avec salon séparé',
    info: '38 m² · 3 pers. · Petit-déj. inclus', price: '119', price_num: 119, price_unit: '/ nuit',
    img: '/images/pexels-artbovich-6758771.jpg', alt: 'Suite Prestige, Front de mer',
    images: ['/images/pexels-artbovich-6758771.jpg', '/images/pexels-artbovich-6315808.jpg'],
    description: 'Suite prestige en front de mer avec salon séparé.', capacity: '3 personnes',
    category: 'hotel', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Front de mer',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-10',
    conditions: 'Réservation en ligne, Annulation gratuite 48h avant',
  },
  {
    id: 'suite-vue-mer-top-floor', title: 'Suite Vue Mer — Top floor', subtitle: 'Suite au dernier étage avec terrasse',
    info: '42 m² · 3 pers. · Terrasse privée', price: '135', price_num: 135, price_unit: '/ nuit',
    img: '/images/pexels-artbovich-6315808.jpg', alt: 'Suite Vue Mer, Top floor',
    images: ['/images/pexels-artbovich-6315808.jpg', '/images/pexels-artbovich-6758771.jpg'],
    description: 'Suite au dernier étage avec terrasse privée.', capacity: '3 personnes',
    category: 'hotel', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Front de mer',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-10',
    conditions: 'Réservation en ligne, Annulation gratuite 48h avant',
  },
  {
    id: 'suite-charme-centre-ville', title: 'Suite Charme — Centre-ville', subtitle: 'Suite élégante en centre-ville',
    info: '35 m² · 2 pers. · Balcon', price: '110', price_num: 110, price_unit: '/ nuit',
    img: '/images/pexels-artbovich-6283961.jpg', alt: 'Suite Charme, Centre-ville',
    images: ['/images/pexels-artbovich-6283961.jpg', '/images/pexels-artbovich-6758771.jpg'],
    description: 'Suite charme au cœur de la ville.', capacity: '2 personnes',
    category: 'hotel', market: 'BJ', pays: 'Bénin', ville: 'Porto-Novo', quartier: 'Centre-ville',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-12',
    conditions: 'Réservation en ligne, Annulation gratuite 24h avant',
  },
  {
    id: 'suite-familiale-calme', title: 'Suite Familiale — Calme', subtitle: 'Grande suite pour famille',
    info: '50 m² · 4 pers. · 2 chambres', price: '155', price_num: 155, price_unit: '/ nuit',
    img: '/images/pexels-artbovich-6238608.jpg', alt: 'Suite Familiale, Calme',
    images: ['/images/pexels-artbovich-6238608.jpg', '/images/pexels-artbovich-6782567.jpg'],
    description: 'Grande suite familiale dans un cadre calme.', capacity: '4 personnes',
    category: 'hotel', market: 'BJ', pays: 'Bénin', ville: 'Ouidah', quartier: 'Périphérie',
    chambres: 2, douches: 2, disponible: true, date_dispo: '2026-09-18',
    conditions: 'Réservation en ligne, Annulation gratuite 48h avant',
  },
  {
    id: 'lumineux-centre-ville-studio', title: 'Lumineux — Centre-ville', subtitle: 'Studio moderne en centre-ville',
    info: '32 m² · 3e ét. asc. · DPE B', price: '430', price_num: 430, price_unit: '/ mois',
    img: '/images/pexels-artbovich-5998120.jpg', alt: 'Lumineux, Centre-ville',
    images: ['/images/pexels-artbovich-5998120.jpg', '/images/pexels-artbovich-5998117.jpg'],
    description: 'Studio lumineux au 3e étage avec ascenseur.', capacity: '2 personnes',
    category: 'appartements-moins-chers', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Centre-ville',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-14',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'cosy-quartier-des-arts', title: 'Cosy — Quartier des arts', subtitle: 'Studio chaleureux et intime',
    info: '28 m² · 2e ét. · DPE C', price: '400', price_num: 400, price_unit: '/ mois',
    img: '/images/pexels-artbovich-5998117.jpg', alt: 'Cosy, Quartier des arts',
    images: ['/images/pexels-artbovich-5998117.jpg', '/images/pexels-artbovich-5998120.jpg'],
    description: 'Studio cosy au cœur du quartier des arts.', capacity: '2 personnes',
    category: 'appartements-moins-chers', market: 'BJ', pays: 'Bénin', ville: 'Porto-Novo', quartier: 'Quartier des arts',
    chambres: 1, douches: 1, disponible: false, date_dispo: '2026-11-15',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'moderne-front-de-mer-studio', title: 'Moderne — Front de mer', subtitle: 'Studio design en bord de mer',
    info: '30 m² · 4e ét. asc. · DPE B', price: '450', price_num: 450, price_unit: '/ mois',
    img: '/images/pexels-artbovich-7214173.jpg', alt: 'Moderne, Front de mer',
    images: ['/images/pexels-artbovich-7214173.jpg', '/images/pexels-artbovich-7045712.jpg'],
    description: 'Studio moderne au 4e étage avec vue mer.', capacity: '2 personnes',
    category: 'appartements-premium', market: 'BJ', pays: 'Bénin', ville: 'Grand Popo', quartier: 'Front de mer',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-10',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'chaleureux-peripherie-studio', title: 'Chaleureux — Périphérie', subtitle: 'Studio calme en périphérie',
    info: '26 m² · 1er ét. · DPE C', price: '380', price_num: 380, price_unit: '/ mois',
    img: '/images/pexels-artbovich-6283961.jpg', alt: 'Chaleureux, Périphérie',
    images: ['/images/pexels-artbovich-6283961.jpg', '/images/pexels-artbovich-5998117.jpg'],
    description: 'Studio chaleureux au 1er étage en périphérie.', capacity: '2 personnes',
    category: 'appartements-moins-chers', market: 'BJ', pays: 'Bénin', ville: 'Cotonou', quartier: 'Périphérie',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-10',
    conditions: 'Caution : 1 mois de loyer, Durée minimale : 6 mois',
  },
  {
    id: 'abidjan-plateau-moderne', title: 'Appartement Moderne — Plateau', subtitle: 'Appartement au cœur du quartier des affaires',
    info: '65 m² · 2 chambres · Climatisation', price: '75 000', price_num: 75000, price_unit: '/ mois',
    img: '/images/pexels-artbovich-7214173.jpg', alt: 'Appartement moderne Plateau Abidjan',
    images: ['/images/pexels-artbovich-7214173.jpg', '/images/pexels-artbovich-7045712.jpg'],
    description: 'Bel appartement moderne au cœur du Plateau.', capacity: '4 personnes',
    category: 'ci-appartements', market: 'CI', pays: "Côte d'Ivoire", ville: 'Abidjan', quartier: 'Plateau',
    chambres: 2, douches: 1, disponible: true, date_dispo: '2026-09-01',
    conditions: 'Caution : 2 mois, Durée minimale : 12 mois',
  },
  {
    id: 'abidjan-cocody-studio', title: 'Studio Élégant — Cocody', subtitle: 'Studio dans quartier résidentiel',
    info: '35 m² · 1 chambre · Meublé', price: '45 000', price_num: 45000, price_unit: '/ mois',
    img: '/images/pexels-artbovich-6782567.jpg', alt: 'Studio élégant Cocody Abidjan',
    images: ['/images/pexels-artbovich-6782567.jpg', '/images/pexels-artbovich-6758771.jpg'],
    description: 'Studio moderne situé dans le quartier résidentiel de Cocody.', capacity: '2 personnes',
    category: 'ci-chambres-premium', market: 'CI', pays: "Côte d'Ivoire", ville: 'Abidjan', quartier: 'Cocody',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-05',
    conditions: 'Caution : 2 mois, Durée minimale : 6 mois',
  },
  {
    id: 'abidjan-marcoral-ville', title: 'Villa Prestigieuse — Marcory', subtitle: 'Villa avec jardin tropical',
    info: '200 m² · 4 chambres · Jardin · Piscine', price: '250 000', price_num: 250000, price_unit: '/ mois',
    img: '/images/pexels-artbovich-6283961.jpg', alt: 'Villa prestige Marcory Abidjan',
    images: ['/images/pexels-artbovich-6283961.jpg', '/images/pexels-artbovich-6238608.jpg'],
    description: 'Magnifique villa dans le quartier huppé de Marcory.', capacity: '8 personnes',
    category: 'ci-appartements', market: 'CI', pays: "Côte d'Ivoire", ville: 'Abidjan', quartier: 'Marcory',
    chambres: 4, douches: 3, disponible: true, date_dispo: '2026-09-15',
    conditions: 'Caution : 3 mois, Durée minimale : 12 mois',
  },
  {
    id: 'abidjan-treichville-studio', title: 'Studio Tout Confort — Treichville', subtitle: 'Studio dans quartier animé',
    info: '25 m² · 1 chambre · WiFi', price: '30 000', price_num: 30000, price_unit: '/ mois',
    img: '/images/pexels-artbovich-5998120.jpg', alt: 'Studio Treichville Abidjan',
    images: ['/images/pexels-artbovich-5998120.jpg', '/images/pexels-artbovich-5998117.jpg'],
    description: 'Studio bien équipé dans le quartier animé de Treichville.', capacity: '2 personnes',
    category: 'ci-chambres-premium', market: 'CI', pays: "Côte d'Ivoire", ville: 'Abidjan', quartier: 'Treichville',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-01',
    conditions: 'Caution : 1 mois, Durée minimale : 6 mois',
  },
  {
    id: 'bouake-centre-appart', title: 'Appartement Spacieux — Bouaké Centre', subtitle: 'Appartement au cœur de la ville',
    info: '55 m² · 2 chambres · Parking', price: '35 000', price_num: 35000, price_unit: '/ mois',
    img: '/images/pexels-artbovich-6315808.jpg', alt: 'Appartement spacieux Bouaké',
    images: ['/images/pexels-artbovich-6315808.jpg', '/images/pexels-artbovich-7045712.jpg'],
    description: 'Grand appartement au centre de Bouaké.', capacity: '4 personnes',
    category: 'ci-appartements', market: 'CI', pays: "Côte d'Ivoire", ville: 'Bouaké', quartier: 'Centre',
    chambres: 2, douches: 1, disponible: true, date_dispo: '2026-09-10',
    conditions: 'Caution : 1 mois, Durée minimale : 6 mois',
  },
  {
    id: 'yamoussoukro-paix-chambre', title: 'Chambre Meublée — Quartier Paix', subtitle: 'Chambre proche de la basilique',
    info: '18 m² · 1 chambre · Meublé', price: '20 000', price_num: 20000, price_unit: '/ mois',
    img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Chambre meublée Yamoussoukro',
    images: ['/images/pexels-fotoaibe-1571460.jpg', '/images/pexels-artbovich-5998120.jpg'],
    description: 'Chambre meublée dans le quartier Paix à Yamoussoukro.', capacity: '1 personne',
    category: 'ci-chambres-moins-chères', market: 'CI', pays: "Côte d'Ivoire", ville: 'Yamoussoukro', quartier: 'Paix',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-01',
    conditions: 'Caution : 1 mois, Durée minimale : 3 mois',
  },
  {
    id: 'san-pedro-port-chambre', title: 'Chambre au Port — San-Pédro', subtitle: 'Chambre pratique près du port',
    info: '16 m² · 1 chambre · Eau courante', price: '18 000', price_num: 18000, price_unit: '/ mois',
    img: '/images/pexels-donaldtong94-189333.jpg', alt: 'Chambre port San-Pédro',
    images: ['/images/pexels-donaldtong94-189333.jpg', '/images/pexels-artbovich-6782567.jpg'],
    description: 'Chambre idéalement située près du port de San-Pédro.', capacity: '1 personne',
    category: 'ci-chambres-moins-chères', market: 'CI', pays: "Côte d'Ivoire", ville: 'San-Pédro', quartier: 'Port',
    chambres: 1, douches: 1, disponible: true, date_dispo: '2026-09-01',
    conditions: 'Caution : 1 mois, Durée minimale : 3 mois',
  },
  // 10 marchés ouverts : ~7 chambres par pays sur les vraies villes.
  ...newMarketRooms,
];

// Événements de démonstration : les IDs sont fixes pour rester idempotents,
// mais les dates sont recalculées à chaque exécution (aujourd'hui + n jours)
// — des dates écrites en dur deviendraient des dates passées au bout de
// quelques mois et la section afficherait « l'événement le plus récent ».
// Le type EventSeed (market: MarketCode) vient de seedMarkets.ts.
const defaultEvents: EventSeed[] = [
  { id: 'ev-bj-cotonou-festival', market: 'BJ', city: 'Cotonou', title: 'Festival du film de Cotonou', description: 'Cinq soirées de cinéma africain en plein air sur la Marina, suivies de rencontres avec les réalisateurs.', inDays: 12, img: '/images/1.jpg', alt: 'Vue de Cotonou' },
  { id: 'ev-bj-cotonou-artisanat', market: 'BJ', city: 'Cotonou', title: "Marché artisanal de la Marina", description: "Deux jours d'artisanat, de musique et de cuisine locale au bord de la lagune.", inDays: 45, img: '/images/1.jpg', alt: 'Marché artisanal à Cotonou' },
  { id: 'ev-bj-ouidah-memoire', market: 'BJ', city: 'Ouidah', title: 'Journées de la mémoire', description: "Parcours guidé sur la route de l'esclavage, conférences et cérémonie au temple des pythons.", inDays: 21, img: '/images/ouidah.jpg', alt: 'Événement à Ouidah' },
  { id: 'ev-bj-ouidah-carnaval', market: 'BJ', city: 'Ouidah', title: 'Carnaval de Ouidah', description: 'Déguisements, tambours et chars décorés défilent du marché à la plage.', inDays: 60, img: '/images/ouidah.jpg', alt: 'Carnaval à Ouidah' },
  { id: 'ev-bj-tori-randonnee', market: 'BJ', city: 'Tori Bossito', title: 'Randonnée des vallées', description: 'Randonnée encadrée de 8 km entre villages, forêt et points de vue sur la rivière.', inDays: 7, img: '/images/tori.jpg', alt: 'Événement à Tori Bossito' },
  { id: 'ev-bj-tori-villages', market: 'BJ', city: 'Tori Bossito', title: 'Portes des villages', description: "Journée portes ouvertes dans les villages de Tori Bossito : artisanat, danses et repas partagés.", inDays: 40, img: '/images/tori.jpg', alt: 'Villages de Tori Bossito' },
  { id: 'ev-ci-abidjan-musique', market: 'CI', city: 'Abidjan', title: 'Fête de la musique', description: 'Scènes gratuites à Plateau et Cocody, du coupé-décalé au jazz, jusqu’à minuit.', inDays: 15, img: '/images/pexels-artbovich-7214173.jpg', alt: 'Fête de la musique à Abidjan' },
  { id: 'ev-ci-abidjan-musees', market: 'CI', city: 'Abidjan', title: 'Nuit des musées', description: 'Entrée libre dans les musées et galeries d’Abidjan, avec visites guidées en soirée.', inDays: 35, img: '/images/pexels-donaldtong94-189333.jpg', alt: 'Nuit des musées à Abidjan' },
  { id: 'ev-ci-bouake-artisanat', market: 'CI', city: 'Bouaké', title: 'Salon artisanal de Bouaké', description: 'Trois jours d’exposition et de démonstrations au grand marché, entrée gratuite.', inDays: 25, img: '/images/pexels-artbovich-6782567.jpg', alt: 'Salon artisanal à Bouaké' },
  { id: 'ev-ci-bouake-masques', market: 'CI', city: 'Bouaké', title: 'Carnaval des masques', description: 'Compagnies de masques de tout le pays se succèdent sur l’avenue Kenyatta.', inDays: 55, img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Carnaval des masques à Bouaké' },
  ...newMarketEvents,
];

// Date locale AAAA-MM-JJ (toISOString() donnerait la date UTC, ce qui peut
// reculer d'un jour selon le fuseau de la machine qui lance le seed).
function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Contrairement aux catégories/chambres, l'admin est la source de vérité des
// événements : on n'insère que les IDs absents. Un upsert remettrait à zéro
// chaque événement que l'admin aurait édité entre deux lancements du seed.
async function seedEvents() {
  const rows = defaultEvents.map((e) => ({
    id: e.id,
    market: e.market,
    city: e.city,
    title: e.title,
    description: e.description,
    event_date: isoInDays(e.inDays),
    img: e.img,
    alt: e.alt,
  }));

  const { data: existing, error: checkError } = await supabaseAdmin
    .from('events')
    .select('id')
    .in('id', rows.map((r) => r.id));
  if (checkError) throw checkError;

  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const toInsert = rows.filter((r) => !existingIds.has(r.id));

  if (toInsert.length === 0) {
    console.log('  événements déjà présents — inchangé');
    return;
  }

  const { error } = await supabaseAdmin.from('events').insert(toInsert);
  if (error) throw error;
  console.log(`  ${toInsert.length} événements créés (${rows.length - toInsert.length} existants conservés)`);
}

// Section Tourisme : une ligne = une destination affichée en carte.
// `featured: false` partout : avec les événements seedés ci-dessus, la règle
// (ville avec événement dans les 30 jours) place Tori Bossito + Ouidah en
// grosses cartes côté BJ et Abidjan + Bouaké côté CI. L'admin reste libre de
// forcer une autre destination via « mettre en avant ».
// Le type TourismSeed (market: MarketCode) vient de seedMarkets.ts.
const defaultTourismDestinations: TourismSeed[] = [
  { id: 'des-bj-ouidah', market: 'BJ', city: 'Ouidah', title: 'Ouidah', description: "Plages de sable fin, cœur touristique et berceau de la mémoire de l'esclavage.", img: '/images/ouidah.jpg', alt: "Plage d'Ouidah" },
  { id: 'des-bj-tori-bossito', market: 'BJ', city: 'Tori Bossito', title: 'Tori Bossito', description: 'Vallées, rivières et villages : randonnées encadrées et artisanat local.', img: '/images/tori.jpg', alt: 'Vallées de Tori Bossito' },
  { id: 'des-bj-grand-popo', market: 'BJ', city: 'Grand Popo', title: 'Grand Popo', description: 'Une ambiance chaleureuse, une plage magnifique et une culture vivante.', img: '/images/tori.jpg', alt: 'Plage de Grand Popo' },
  { id: 'des-bj-nikki', market: 'BJ', city: 'Nikki', title: 'Nikki', description: 'Village lacustre aux maisons colorées sur pilotis.', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Maisons colorées de Nikki' },
  { id: 'des-bj-ganvie', market: 'BJ', city: 'Ganvié', title: 'Ganvié', description: "Venise de l'Afrique, marchés flottants et traditions.", img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Marché flottant de Ganvié' },
  { id: 'des-bj-porto-novo', market: 'BJ', city: 'Porto-Novo', title: 'Porto-Novo', description: 'Capitale culturelle, architecture afro-brésilienne.', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Architecture de Porto-Novo' },
  { id: 'des-bj-abomey', market: 'BJ', city: 'Abomey', title: 'Abomey', description: 'Palais royaux classés au patrimoine mondial UNESCO.', img: '/images/pexels-artbovich-6283961.jpg', alt: 'Palais royaux d’Abomey' },
  { id: 'des-ci-abidjan', market: 'CI', city: 'Abidjan', title: 'Abidjan', description: 'Le Plateau, Cocody et la lagune Ébrié : énergie, maquis et scènes culturelles.', img: '/images/pexels-artbovich-7214173.jpg', alt: 'Abidjan vue depuis la ville' },
  { id: 'des-ci-bouake', market: 'CI', city: 'Bouaké', title: 'Bouaké', description: 'Deuxième ville du pays : grand marché, artisanat et capitale des masques.', img: '/images/pexels-artbovich-6782567.jpg', alt: 'Grand marché de Bouaké' },
  { id: 'des-ci-grand-bassam', market: 'CI', city: 'Grand-Bassam', title: 'Grand-Bassam', description: "Première capitale du pays, classée à l'UNESCO : patrimoine créole et plages de sable fin.", img: '/images/pexels-fotoaibe-1571460.jpg', alt: 'Plage de Grand-Bassam' },
  { id: 'des-ci-assinie', market: 'CI', city: 'Assinie', title: 'Assinie', description: 'Plages et lagunes entre cocotiers, à deux pas d’Abidjan.', img: '/images/pexels-artbovich-7045712.jpg', alt: 'Lagune d’Assinie' },
  { id: 'des-ci-yamoussoukro', market: 'CI', city: 'Yamoussoukro', title: 'Yamoussoukro', description: 'Basilique de la Paix et jardins de la capitale politique.', img: '/images/pexels-artbovich-6283961.jpg', alt: 'Basilique de Yamoussoukro' },
  { id: 'des-ci-korhogo', market: 'CI', city: 'Korhogo', title: 'Korhogo', description: 'Capitale du nord : tissages, masques et savanes.', img: '/images/ouidah.jpg', alt: 'Tissages de Korhogo' },
  { id: 'des-ci-san-pedro', market: 'CI', city: 'San-Pédro', title: 'San-Pédro', description: 'Premier port du pays, plages et faune marine.', img: '/images/tori.jpg', alt: 'Plage de San-Pédro' },
  ...newMarketTourism,
];

// Comme les événements : l'admin est la source de vérité, on n'insère que les
// IDs absents pour ne pas réinitialiser ce qu'il aurait édité entre deux
// lancements du seed.
async function seedTourism() {
  const rows = defaultTourismDestinations.map((destination) => ({ ...destination, featured: false }));

  const { data: existing, error: checkError } = await supabaseAdmin
    .from('tourism_destinations')
    .select('id')
    .in('id', rows.map((r) => r.id));
  if (checkError) throw checkError;

  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const toInsert = rows.filter((r) => !existingIds.has(r.id));

  if (toInsert.length === 0) {
    console.log('  destinations déjà présentes — inchangé');
    return;
  }

  const { error } = await supabaseAdmin.from('tourism_destinations').insert(toInsert);
  if (error) throw error;
  console.log(`  ${toInsert.length} destinations créées (${rows.length - toInsert.length} existantes conservées)`);
}

// La table `admins` est vide tant que personne ne l'écrit : sans ce seed,
// /api/admin/login répond toujours 401 « Email ou mot de passe incorrect ».
// Aucun mot de passe en dur : il vient de l'environnement. Si le compte
// existe déjà, son mot de passe n'est PAS réécrit (un admin l'aurait pu
// changer depuis, réinitialiser le ferait échouer sa connexion).
async function seedAdmin() {
  const email = (process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || '';

  if (!email || !password) {
    console.log('[seed] Admin ignoré : ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD absents du .env');
    return;
  }
  if (password.length < 6) {
    throw new Error('[seed] ADMIN_SEED_PASSWORD doit faire au moins 6 caractères (règle de adminChangePasswordSchema)');
  }

  const { data: existing, error: checkError } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (checkError) throw checkError;

  if (existing) {
    console.log(`  admin ${email} déjà présent — mot de passe inchangé`);
    return;
  }

  const { error: insertError } = await supabaseAdmin.from('admins').insert({
    email,
    password_hash: await bcrypt.hash(password, 12),
    nom: (process.env.ADMIN_SEED_NOM || 'Linkhoo').trim(),
    prenom: (process.env.ADMIN_SEED_PRENOM || 'Admin').trim(),
  });
  if (insertError) throw insertError;
  console.log(`  admin ${email} créé`);
}

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    console.error('[seed] Refusé : NODE_ENV=production sans ALLOW_SEED=true. Ajoutez ALLOW_SEED=true pour lancer le seed volontairement.');
    process.exit(1);
  }

  console.log('Seeding categories...');
  const { error: catError } = await supabaseAdmin.from('categories').upsert(defaultCategories, { onConflict: 'id' });
  if (catError) console.error('Categories error:', catError.message);
  else console.log(`  ${defaultCategories.length} categories seeded`);

  console.log('Seeding rooms...');
  const { error: roomError } = await supabaseAdmin.from('rooms').upsert(defaultRooms, { onConflict: 'id' });
  if (roomError) console.error('Rooms error:', roomError.message);
  else console.log(`  ${defaultRooms.length} rooms seeded`);

  console.log('Seeding admin...');
  await seedAdmin();

  console.log('Seeding events...');
  await seedEvents();

  console.log('Seeding tourism destinations...');
  await seedTourism();

  console.log('Done!');
}

seed().catch((err) => {
  console.error('[seed] Échec:', err instanceof Error ? err.message : err);
  process.exit(1);
});
