import { z } from 'zod';
import { marketSchema } from './common';

export const roleSchema = z.enum(['client', 'gerant']);

export const bootstrapSchema = z
  .object({
    role: roleSchema,
    market: marketSchema.optional(),
    // Téléphone OBLIGATOIRE pour un gérant : sert à vérifier qu'il appartient
    // au marché déclaré (contrôle de l'indicatif côté backend).
    phone: z.string().trim().min(6).max(30).optional(),
  })
  .strict();

export type AuthRole = z.infer<typeof roleSchema>;
