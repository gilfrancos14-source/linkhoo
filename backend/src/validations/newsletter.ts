import { z } from 'zod';
import { emailSchema, marketSchema } from './common';

export const newsletterSubscribeSchema = z
  .object({
    email: emailSchema,
    market: marketSchema.optional(),
  })
  .strict();
