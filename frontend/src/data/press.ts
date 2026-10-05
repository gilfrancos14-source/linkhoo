// Bloc « On parle de nous » du pied de page (colonne 2, structure
// CoinAfrique). Contenu statique : à remplacer par les vraies parutions.

export interface PressItem {
  id: string;
  titre: string;
  date: string;
  source: string;
}

export const PRESS_ITEMS: PressItem[] = [
  {
    id: 'lancement-ci',
    titre: 'Linkhoo accélère la location directe en Côte d’Ivoire',
    date: '12 mars 2026',
    source: 'actu-abidjan.ci',
  },
  {
    id: 'levee-fonds',
    titre: 'Le proptech ivoirien attire les investisseurs',
    date: '28 janvier 2026',
    source: 'techafrica.news',
  },
  {
    id: 'benin',
    titre: 'Au Bénin, la location sans intermédiaire se démocratise',
    date: '5 décembre 2025',
    source: 'lanouvelletribune.bj',
  },
];
