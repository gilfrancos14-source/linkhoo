import { z } from 'zod';
import { marketSchema, withoutPhoneNumber } from './common';

const SUPABASE_PUBLIC_IMAGE_RE =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;
const LOCAL_IMAGE_RE = /^\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => SUPABASE_PUBLIC_IMAGE_RE.test(value) || LOCAL_IMAGE_RE.test(value), {
    message: "URL d'image invalide : seules les images du stockage de la plateforme sont acceptées",
  });

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
    lieu: z.string().trim().min(1).max(120),
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
    lieu: z.string().trim().min(1).max(120).optional(),
    description: withoutPhoneNumber(z.string().trim().min(1).max(2000)).optional(),
    images: z.array(imageUrlSchema).min(1).max(5).optional(),
  })
  .strict();
