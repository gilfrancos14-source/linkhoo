// Témoignages de repli de la page d'accueil : affichés quand l'API
// /reviews/featured ne renvoie rien (comme CoinAfrique, le bloc ne
// disparaît jamais sur la landing).

export interface LandingTestimonial {
  id: string;
  prenom: string;
  nom: string;
  pays: string;
  titre: string;
  texte: string;
}

export const LANDING_TESTIMONIALS: LandingTestimonial[] = [
  {
    id: 'awa',
    prenom: 'Awa',
    nom: 'Awa Kouassi',
    pays: 'Côte d’Ivoire',
    titre: 'Rapide et efficace',
    texte: 'J’ai réservé une chambre à Abidjan en quelques minutes. Le contact direct avec le gérant change tout.',
  },
  {
    id: 'koffi',
    prenom: 'Koffi',
    nom: 'Koffi Mensah',
    pays: 'Bénin',
    titre: 'Simple d’utilisation',
    texte: 'Application claire, les photos sont fidèles et les prix affichés sont justes. Je recommande.',
  },
  {
    id: 'fatou',
    prenom: 'Fatou',
    nom: 'Fatou Ndiaye',
    pays: 'Côte d’Ivoire',
    titre: 'Parfait pour les escales',
    texte: 'Je voyage souvent pour le travail : je trouve toujours un logement proche de mes rendez-vous.',
  },
  {
    id: 'sylvain',
    prenom: 'Sylvain',
    nom: 'Sylvain Agbodjan',
    pays: 'Bénin',
    titre: 'Une équipe réactive',
    texte: 'Un souci de check-in un soir : le support a répondu en moins de dix minutes. Impeccable.',
  },
  {
    id: 'mariam',
    prenom: 'Mariam',
    nom: 'Mariam Traoré',
    pays: 'Côte d’Ivoire',
    titre: 'Grosse découverte',
    texte: 'Des appartements corrects à des prix raisonnables, sans passer par une agence. Adopté.',
  },
  {
    id: 'emmanuel',
    prenom: 'Emmanuel',
    nom: 'Emmanuel Hounkpatin',
    pays: 'Bénin',
    titre: 'Le contact direct, sans intermédiaire',
    texte: 'On paie au gérant, on discute direct : c’est plus simple et plus transparent pour tout le monde.',
  },
];
