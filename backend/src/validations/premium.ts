import { z } from 'zod';
import { marketSchema } from './common';

export const premiumInitiateSchema = z
  .object({
    market: marketSchema,
  })
  .strict();

export const premiumConfirmSchema = z
  .object({
    transaction_id: z.coerce.number().int().positive(),
  })
  .strict();
