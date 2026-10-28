import { z } from 'zod';
import { marketSchema } from './common';
import { paymentReferenceSchema } from './payments';

export const premiumInitiateSchema = z
  .object({
    market: marketSchema,
  })
  .strict();

/**
 * Confirmation d'un paiement Premium.
 *
 * Les deux prestataires cohabitent le temps de la migration : FedaPay identifie
 * la transaction par `transaction_id`, Hub2 par la `reference` interne. Un seul
 * des deux champs doit être fourni ; la route choisit ensuite selon
 * `PAYMENTS_PROVIDER`.
 */
export const premiumConfirmSchema = z
  .object({
    transaction_id: z.coerce.number().int().positive().optional(),
    reference: paymentReferenceSchema.optional(),
  })
  .strict()
  .refine(
    (value) => (value.transaction_id === undefined) !== (value.reference === undefined),
    { message: 'Fournissez transaction_id (FedaPay) ou reference (Hub2), pas les deux.' },
  );
