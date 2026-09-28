import { z } from 'zod';
import { emailSchema } from './common';

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === '' || /^[\d\s+()-]{6,}$/.test(value), 'Numéro de téléphone invalide')
  .optional()
  .default('');

export const clientCreateSchema = z
  .object({
    clerk_user_id: z.string().trim().min(1).max(200),
    email: emailSchema,
    nom: z.string().trim().max(100).optional().default(''),
    prenom: z.string().trim().max(100).optional().default(''),
    telephone: phoneSchema,
  })
  .strict();

export const clientUpdateSchema = z
  .object({
    nom: z.string().trim().max(100).optional(),
    prenom: z.string().trim().max(100).optional(),
    telephone: z.string().trim().max(30).optional(),
  })
  .strict();
