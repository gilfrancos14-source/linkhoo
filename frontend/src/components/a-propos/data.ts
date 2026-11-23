import type { IconName } from '../landing/icons';

/** Partie graphique uniquement : les textes viennent des fichiers i18n. */
export const ABOUT_STAT_ICONS: readonly IconName[] = [
  'house',
  'users',
  'building2',
  'shieldCheck',
];

export const ABOUT_BENEFIT_STYLES: readonly {
  icon: IconName;
  tone: 'green' | 'brand' | 'orange' | 'indigo';
}[] = [
  { icon: 'shieldCheck', tone: 'green' },
  { icon: 'zap', tone: 'brand' },
  { icon: 'headphones', tone: 'orange' },
  { icon: 'map', tone: 'indigo' },
];

export const ABOUT_TEAM_ICONS: readonly IconName[] = [
  'lightbulb',
  'userRound',
  'clipboardCheck',
  'badgeCheck',
];
