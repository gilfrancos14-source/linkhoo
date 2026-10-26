import type { IconName } from '../landing/icons';

export const ABOUT_VALUES = [
  'Confiance',
  'Proximité',
  'Simplicité',
  'Innovation',
  'Impact local',
] as const;

export interface AboutStat {
  readonly icon: IconName;
  readonly value: string;
  readonly label: string;
  readonly note: string;
}

export const ABOUT_STATS: readonly AboutStat[] = [
  { icon: 'house', value: '12', label: 'pays couverts', note: 'Du Sénégal au Togo' },
  { icon: 'users', value: '+ 50 000', label: 'voyageurs', note: 'nous font confiance' },
  {
    icon: 'building2',
    value: '+ 10 000',
    label: 'annonces',
    note: 'de logements et chambres',
  },
  { icon: 'shieldCheck', value: '99%', label: 'de satisfaction', note: 'de nos utilisateurs' },
];

export interface AboutBenefit {
  readonly icon: IconName;
  readonly tone: 'green' | 'brand' | 'orange' | 'indigo';
  readonly title: string;
  readonly text: string;
}

export const ABOUT_BENEFITS: readonly AboutBenefit[] = [
  {
    icon: 'shieldCheck',
    tone: 'green',
    title: 'Paiement sécurisé',
    text: 'Transactions protégées et fiables.',
  },
  {
    icon: 'zap',
    tone: 'brand',
    title: 'Réservation instantanée',
    text: 'Réservez en quelques clics, sans stress.',
  },
  {
    icon: 'headphones',
    tone: 'orange',
    title: 'Service client réactif',
    text: 'Une équipe à votre écoute 24/7.',
  },
  {
    icon: 'map',
    tone: 'indigo',
    title: 'Ancrage local',
    text: 'Une connaissance unique des marchés de la région.',
  },
];

export interface AboutTeamValue {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
}

export const ABOUT_TEAM_VALUES: readonly AboutTeamValue[] = [
  { icon: 'lightbulb', title: 'Innovation', text: 'au quotidien' },
  { icon: 'userRound', title: 'Proximité', text: 'avec nos utilisateurs' },
  { icon: 'clipboardCheck', title: 'Engagement', text: 'pour la région' },
  { icon: 'badgeCheck', title: 'Excellence', text: 'dans tout ce que nous faisons' },
];
