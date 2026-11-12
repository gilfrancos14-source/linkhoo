import { z } from 'zod';
import { emailSchema, marketSchema, optionalTextSafe, withoutPhoneNumber } from './common';

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
    // Le nom est affiché publiquement (avis) et aux gérants (messagerie,
    // réservations) : il ne doit pas servir de canal de contact.
    nom: optionalTextSafe(100),
    prenom: optionalTextSafe(100),
    telephone: phoneSchema,
    market: marketSchema,
  })
  .strict();

export const clientUpdateSchema = z
  .object({
    nom: withoutPhoneNumber(z.string().trim().max(100)).optional(),
    prenom: withoutPhoneNumber(z.string().trim().max(100)).optional(),
    telephone: z.string().trim().max(30).optional(),
  })
  .strict();
