import { z } from 'zod';

export const marketSchema = z.enum(['CI', 'BJ']);

export const idSchema = z.string().trim().min(1).max(200);

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Date invalide');

export const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

export const marketQuerySchema = z.object({
  market: marketSchema.optional(),
});

export const idParamsSchema = z.object({
  id: idSchema,
});
