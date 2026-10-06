/**
 * Registre des marchés — source de vérité BACKEND.
 *
 * MIROIR de `frontend/src/config/markets.ts` : les deux packages sont
 * indépendants (aucun import croisé possible), donc la liste est dupliquée
 * ET figée par un test de synchronisation de chaque côté
 * (`src/config/markets.test.ts`) qui compare à cette même constante.
 *
 * Ouvrir un marché = ajouter une entrée ici + dans le miroir front + une
 * ligne dans la migration CHECK (backend/supabase/migrations/) + le seed.
 */

export const MARKET_CODES = [
  'CI',
  'BJ',
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

export type MarketCode = (typeof MARKET_CODES)[number];

export interface MarketDefinition {
  readonly code: MarketCode;
  /** Segment d'URL, minuscules : /sn, /bj, … */
  readonly slug: string;
  /** Libellé affiché (sélecteur, filtres admin, pages de connexion). */
  readonly label: string;
  /** Pays au format du formulaire de contact / colonne `rooms.pays`. */
  readonly pays: string;
  /** Devise unique de la plateforme : tout est facturé en XOF (FCFA). */
  readonly currency: 'XOF';
  /** Centre de la carte (capitale) pour le repérage gérant. */
  readonly center: { readonly lat: number; readonly lng: number };
}

export const MARKETS = [
  { code: 'CI', slug: 'ci', label: "Côte d'Ivoire", pays: "Côte d'Ivoire", currency: 'XOF', center: { lat: 5.36, lng: -4.008 } },
  { code: 'BJ', slug: 'bj', label: 'Bénin', pays: 'Bénin', currency: 'XOF', center: { lat: 6.3703, lng: 2.3912 } },
  { code: 'SN', slug: 'sn', label: 'Sénégal', pays: 'Sénégal', currency: 'XOF', center: { lat: 14.7167, lng: -17.4677 } },
  { code: 'TG', slug: 'tg', label: 'Togo', pays: 'Togo', currency: 'XOF', center: { lat: 6.1319, lng: 1.2228 } },
  { code: 'CM', slug: 'cm', label: 'Cameroun', pays: 'Cameroun', currency: 'XOF', center: { lat: 3.848, lng: 11.5021 } },
  { code: 'BF', slug: 'bf', label: 'Burkina Faso', pays: 'Burkina Faso', currency: 'XOF', center: { lat: 12.3714, lng: -1.5197 } },
  { code: 'CG', slug: 'cg', label: 'Congo', pays: 'Congo', currency: 'XOF', center: { lat: -4.2634, lng: 15.2429 } },
  { code: 'GA', slug: 'ga', label: 'Gabon', pays: 'Gabon', currency: 'XOF', center: { lat: 0.4162, lng: 9.4673 } },
  { code: 'GN', slug: 'gn', label: 'Guinée', pays: 'Guinée', currency: 'XOF', center: { lat: 9.5375, lng: -13.6772 } },
  { code: 'ML', slug: 'ml', label: 'Mali', pays: 'Mali', currency: 'XOF', center: { lat: 12.6392, lng: -8.0029 } },
  { code: 'NE', slug: 'ne', label: 'Niger', pays: 'Niger', currency: 'XOF', center: { lat: 13.5127, lng: 2.1128 } },
  { code: 'CD', slug: 'cd', label: 'RDC', pays: 'RDC', currency: 'XOF', center: { lat: -4.3276, lng: 15.3132 } },
] as const satisfies readonly MarketDefinition[];

export function isMarketCode(value: unknown): value is MarketCode {
  return typeof value === 'string' && (MARKET_CODES as readonly string[]).includes(value);
}

export function marketByCode(code: MarketCode): MarketDefinition {
  const found = MARKETS.find((m) => m.code === code);
  if (!found) throw new Error(`Marché inconnu : ${code}`);
  return found;
}
