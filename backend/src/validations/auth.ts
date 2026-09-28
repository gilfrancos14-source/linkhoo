import { z } from 'zod';
import { marketSchema } from './common';

export const roleSchema = z.enum(['client', 'gerant']);

export const bootstrapSchema = z
  .object({
    role: roleSchema,
    market: marketSchema.optional(),
  })
  .strict();

export type AuthRole = z.infer<typeof roleSchema>;
