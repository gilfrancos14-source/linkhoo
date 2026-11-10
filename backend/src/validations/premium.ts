import { z } from 'zod';
import { marketSchema } from './common';
import { paymentReferenceSchema } from './payments';
import { isPremiumPlanId, type PremiumPlanId } from '../payments/premiumPlans';

/**
 * Initiation d'un paiement Premium.
 *
 * Le client envoie uniquement l'identifiant de la formule : le prix et la
 * durée sont résolus côté serveur (`premiumPlans.ts`). Un montant présent
 * dans le corps est refusé par `.strict()`.
 */
export const premiumInitiateSchema = z
  .object({
    market: marketSchema,
    plan: z
      .custom<PremiumPlanId>((value) => isPremiumPlanId(value), {
        message: 'Formule premium inconnue.',
      })
      .optional(),
  })
  .strict();

/**
 * Confirmation d'un paiement Premium.
 *
 * pawaPay identifie la transaction par la `reference` interne.
 */
export const premiumConfirmSchema = z
  .object({
    reference: paymentReferenceSchema,
  })
  .strict();
