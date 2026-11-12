import { z } from 'zod';
import { marketSchema, optionalTextSafe, dateStringSchema, withoutPhoneNumber } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

// `market` est OBLIGATOIRE pour le site public : GET /api/events sert à
// construire les cartes par ville, et sans marché les villes se
// mélangeraient en produisant un marqueur faux.
// Le back-office peut l'OMETTRE (avec `include_past=1`) pour lister TOUS les
// marchés en une seule requête (section Événements). `include_past=1` est
// réservé au back-office (exigé par requireAdminAuth sur la route) : le public
// ne reçoit que les événements à venir, et doit donc préciser `market`.
export const eventQuerySchema = z
  .object({
    market: marketSchema.optional(),
    include_past: z.enum(['0', '1']).optional(),
  })
  .strict()
  .refine((v) => v.market !== undefined || v.include_past === '1', {
    message: 'market est requis pour le site public',
  });

export const eventCreateSchema = z
  .object({
    market: marketSchema,
    city: withoutPhoneNumber(z.string().trim().min(1).max(120)),
    title: withoutPhoneNumber(z.string().trim().min(1).max(200)),
    description: withoutPhoneNumber(optionalTextSafe(2000)),
    event_date: dateStringSchema,
    img: imageUrlSchema,
    alt: optionalTextSafe(300),
  })
  .strict();

// Schéma explicite plutôt que eventCreateSchema.partial() : `optionalText`
// porte un .default(''), qui survit à .partial() et écraserait description
// et alt par '' à chaque mise à jour partielle.
export const eventUpdateSchema = z
  .object({
    market: marketSchema.optional(),
    city: withoutPhoneNumber(z.string().trim().min(1).max(120)).optional(),
    title: withoutPhoneNumber(z.string().trim().min(1).max(200)).optional(),
    description: withoutPhoneNumber(z.string().trim().max(2000)).optional(),
    event_date: dateStringSchema.optional(),
    img: imageUrlSchema.optional(),
    alt: withoutPhoneNumber(z.string().trim().max(300)).optional(),
  })
  .strict();
