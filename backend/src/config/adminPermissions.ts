/**
 * Catalogue des permissions du back-office : une clé par section protégée.
 * Frontend et backend partagent les mêmes clés (libellés servis par
 * GET /api/admin/admins/permissions pour peupler l'écran Équipe).
 */
export const ADMIN_PERMISSION_KEYS = [
  'gerants',
  'reservations',
  'bannieres',
  'evenements',
  'destinations',
  'escapades',
  'promotions',
  'boosts',
  'stats',
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export interface AdminPermissionDef {
  key: AdminPermissionKey;
  label: string;
  description: string;
}

export const ADMIN_PERMISSIONS: readonly AdminPermissionDef[] = [
  { key: 'gerants', label: 'Gérants', description: 'Vérification des comptes et des documents gérants' },
  { key: 'reservations', label: 'Réservations', description: 'Consultation et traitement des réservations' },
  { key: 'bannieres', label: 'Bannières', description: "Gestion des bannières de la page d'accueil" },
  { key: 'evenements', label: 'Événements', description: 'Gestion des événements (passés inclus)' },
  { key: 'destinations', label: 'Destinations', description: 'Gestion des destinations touristiques' },
  { key: 'escapades', label: 'Escapades', description: "Gestion des cartes de la section Escapade weekend" },
  { key: 'promotions', label: 'Promotions', description: 'Groupes de promotion des chambres' },
  { key: 'boosts', label: 'Booster', description: 'Supervision des campagnes de boosting' },
  { key: 'stats', label: 'Tableau de bord', description: 'Statistiques et indicateurs globaux' },
];

export function isPermissionKey(value: unknown): value is AdminPermissionKey {
  return typeof value === 'string' && (ADMIN_PERMISSION_KEYS as readonly string[]).includes(value);
}
