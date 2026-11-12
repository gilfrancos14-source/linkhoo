import { z } from 'zod';
import { marketSchema, withoutPhoneNumber } from './common';
import { imageUrlSchema } from './imageUrl';

// Même raisonnement que eventQuerySchema : sans marché, les cartes CI et BJ
// se mélangeraient et /bj afficherait des sorties ivoiriennes.
export const escapadeQuerySchema = z
  .object({
    market: marketSchema,
  })
  .strict();

export const escapadeCreateSchema = z
  .object({
    market: marketSchema,
    lieu: withoutPhoneNumber(z.string().trim().min(1).max(120)),
    description: withoutPhoneNumber(z.string().trim().min(1).max(2000)),
    // 1 à 5 photos : la première sert de couverture sur la carte, toutes
    // apparaissent dans le carrousel du panneau de détails.
    images: z.array(imageUrlSchema).min(1).max(5),
  })
  .strict();

// Schéma explicite plutôt que escapadeCreateSchema.partial() : comme sur
// les destinations, on ne veut pas d'écrasement silencieux par défauts.
export const escapadeUpdateSchema = z
  .object({
    market: marketSchema.optional(),
    lieu: withoutPhoneNumber(z.string().trim().min(1).max(120)).optional(),
    description: withoutPhoneNumber(z.string().trim().min(1).max(2000)).optional(),
    images: z.array(imageUrlSchema).min(1).max(5).optional(),
  })
  .strict();
