import { z } from 'zod';
import { marketSchema, optionalText, dateStringSchema } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

// `market` est OBLIGATOIRE sur ce point d'entrée : GET /api/events sert à
// construire les cartes par ville, et sans marché les villes CI et BJ se
// mélangeraient en produisant un marqueur faux.
// `include_past=1` est réservé au back-office (exigé par requireAdminAuth sur
// la route) : le public ne reçoit que les événements à venir.
export const eventQuerySchema = z
  .object({
    market: marketSchema,
    include_past: z.enum(['0', '1']).optional(),
  })
  .strict();

export const eventCreateSchema = z
  .object({
    market: marketSchema,
    city: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    description: optionalText(2000),
    event_date: dateStringSchema,
    img: imageUrlSchema,
    alt: optionalText(300),
  })
  .strict();

// Schéma explicite plutôt que eventCreateSchema.partial() : `optionalText`
// porte un .default(''), qui survit à .partial() et écraserait description
// et alt par '' à chaque mise à jour partielle.
export const eventUpdateSchema = z
  .object({
    market: marketSchema.optional(),
    city: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    event_date: dateStringSchema.optional(),
    img: imageUrlSchema.optional(),
    alt: z.string().trim().max(300).optional(),
  })
  .strict();
