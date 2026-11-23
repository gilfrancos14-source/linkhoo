import type { IconName } from '../landing/icons';

/** Clés stables des sujets : les libellés viennent de i18n, la valeur envoyée
 *  à l'API reste indépendante de la langue choisie. */
export const CONTACT_SUBJECT_KEYS = [
  'general',
  'publish',
  'technical',
  'payment',
  'suggestion',
] as const;

export type ContactSubjectKey = (typeof CONTACT_SUBJECT_KEYS)[number];

/** Partie graphique uniquement : les textes viennent des fichiers i18n. */
export const CONTACT_HIGHLIGHT_ICONS: readonly IconName[] = [
  'badgeCheck',
  'userRound',
  'shieldCheck',
];
