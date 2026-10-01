import { z } from 'zod';
import { marketSchema, optionalText } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

// Même raisonnement que eventQuerySchema : sans marché, les destinations CI
// et BJ se mélangeraient et la partition grosse/petite carte deviendrait fausse.
export const destinationQuerySchema = z
  .object({
    market: marketSchema,
  })
  .strict();

export const destinationCreateSchema = z
  .object({
    market: marketSchema,
    city: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    // Colonne NOT NULL sans défaut : description est obligatoire à la création.
    description: z.string().trim().min(1).max(2000),
    img: imageUrlSchema,
    alt: optionalText(300),
    featured: z.boolean().optional().default(false),
  })
  .strict();

// Schéma explicite plutôt que destinationCreateSchema.partial() : comme sur
// les événements, optionalText porte un .default('') qui survivrait à
// .partial() et écraserait alt par '' à chaque mise à jour partielle.
export const destinationUpdateSchema = z
  .object({
    market: marketSchema.optional(),
    city: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    img: imageUrlSchema.optional(),
    alt: z.string().trim().max(300).optional(),
    featured: z.boolean().optional(),
  })
  .strict();
