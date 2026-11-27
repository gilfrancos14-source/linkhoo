/** Miroir frontend du catalogue backend `config/equipments.ts`. */
export const EQUIPMENT_KEYS = [
  'wifi',
  'climatisation',
  'ventilateur',
  'eau_chaude',
  'television',
  'prises_lit',
  'linge_lit',
  'serviettes',
  'douche_privee',
  'toilettes_privees',
  'seche_cheveux',
  'cuisine_equipee',
  'refrigerateur',
  'cuisiniere',
  'micro_ondes',
  'bouilloire',
  'vaisselle',
  'eau_filtree',
  'parking',
  'machine_laver',
  'terrasse',
  'piscine',
  'checkin_autonome',
  'ascenseur',
  'coffre_fort',
  'gardien',
  'camera',
  'groupe_electrogene',
  'animaux_acceptes',
  'non_fumeur',
] as const;

export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

export const EQUIPMENT_CATEGORIES: readonly {
  readonly key: string;
  readonly items: readonly EquipmentKey[];
}[] = [
  {
    key: 'confort',
    items: [
      'wifi',
      'climatisation',
      'ventilateur',
      'eau_chaude',
      'television',
      'prises_lit',
      'linge_lit',
      'serviettes',
      'douche_privee',
      'toilettes_privees',
      'seche_cheveux',
    ],
  },
  {
    key: 'cuisine',
    items: [
      'cuisine_equipee',
      'refrigerateur',
      'cuisiniere',
      'micro_ondes',
      'bouilloire',
      'vaisselle',
      'eau_filtree',
    ],
  },
  {
    key: 'pratique',
    items: [
      'parking',
      'machine_laver',
      'terrasse',
      'piscine',
      'checkin_autonome',
      'ascenseur',
      'coffre_fort',
      'gardien',
      'camera',
      'groupe_electrogene',
      'animaux_acceptes',
      'non_fumeur',
    ],
  },
];

export const RESTAURATION_KEYS = [
  'aucune',
  'petit_dejeuner_inclus',
  'petit_dejeuner_option',
  'repas_sur_demande',
  'restaurant',
] as const;

export type RestaurationKey = (typeof RESTAURATION_KEYS)[number];
