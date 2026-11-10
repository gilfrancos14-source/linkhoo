/**
 * Formules de l'abonnement Premium.
 *
 * Le front propose trois formules (mensuelle, trimestrielle, annuelle). Le
 * montant n'est JAMAIS lu du corps de la requête : le client envoie seulement
 * l'identifiant de la formule, le serveur résout le prix et la durée. Une
 * requête forgée ne peut donc pas payer 1 FCFA pour un abonnement annuel.
 *
 * Le prix de référence est exprimé en XOF (parité fixe XAF = XOF, cf.
 * `fx_rates`) ; la conversion vers la devise du marché reste dans
 * `createCheckout` / `createPawapayCheckout`.
 *
 * `days` : durée créditée. La formule annuelle applique le « 1 mois offert »
 * affiché sur la page : 12 mois de 30 jours + 1 mois = 390 jours.
 */

export type PremiumPlanId = 'monthly' | 'quarterly' | 'yearly';

export interface PremiumPlan {
  readonly id: PremiumPlanId;
  readonly amountXof: number;
  readonly days: number;
  /** Libellé français, utilisé dans les descriptions de checkout. */
  readonly label: string;
}

export const PREMIUM_PLANS: Record<PremiumPlanId, PremiumPlan> = {
  monthly: { id: 'monthly', amountXof: 15_000, days: 30, label: 'Mensuel' },
  quarterly: { id: 'quarterly', amountXof: 40_000, days: 90, label: 'Trimestriel' },
  yearly: { id: 'yearly', amountXof: 150_000, days: 390, label: 'Annuel' },
};

export const PREMIUM_PLAN_IDS = Object.keys(PREMIUM_PLANS) as PremiumPlanId[];

export const DEFAULT_PREMIUM_PLAN: PremiumPlanId = 'monthly';

export function isPremiumPlanId(value: unknown): value is PremiumPlanId {
  return typeof value === 'string' && value in PREMIUM_PLANS;
}

/** Résout une formule ; une valeur absente ou inconnue retombe sur la mensuelle. */
export function resolvePremiumPlan(plan?: string | null): PremiumPlan {
  return isPremiumPlanId(plan) ? PREMIUM_PLANS[plan] : PREMIUM_PLANS[DEFAULT_PREMIUM_PLAN];
}

/**
 * Durée stockée dans `payments.metadata.premium_days` à la création du
 * checkout. Relue au moment du claim (webhook ou retour navigateur) pour
 * créditer la bonne durée — indépendamment de la formule courante.
 */
export function premiumDaysFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallback: number = PREMIUM_PLANS[DEFAULT_PREMIUM_PLAN].days,
): number {
  const raw = metadata?.premium_days;
  const days = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(days) && days > 0 ? Math.trunc(days) : fallback;
}
