import { z } from 'zod';
import { dateStringSchema, marketSchema, optionalText } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

export const roomCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    subtitle: optionalText(300),
    info: optionalText(300),
    price: z.string().trim().min(1).max(50),
    price_num: z.number().int().positive().max(1000000000),
    price_unit: z.enum(['/ mois', '/ nuit']),
    img: imageUrlSchema,
    alt: optionalText(300),
    images: z.array(imageUrlSchema).min(1).max(3),
    description: z.string().trim().min(1).max(10000),
    capacity: optionalText(100),
    category: z.string().trim().min(1).max(200),
    market: marketSchema,
    pays: z.string().trim().min(1).max(100),
    ville: z.string().trim().min(1).max(150),
    quartier: z.string().trim().min(1).max(200),
    chambres: z.number().int().positive().max(100),
    douches: z.number().int().positive().max(100),
    disponible: z.boolean(),
    date_dispo: z.string().trim().max(50).optional().default(''),
    conditions: z.string().trim().min(1).max(5000),
    is_popular: z.boolean().optional().default(false),
    promo_group: z.enum(['promo_15', 'promo_10', 'promo_5']).nullable().optional(),
    promo_start: z.string().nullable().optional(),
    promo_end: z.string().nullable().optional(),
  })
  .strict();

export const roomUpdateSchema = roomCreateSchema.partial().strict();

export const roomAvailableQuerySchema = z
  .object({
    market: marketSchema.optional(),
    arrivee: dateStringSchema,
    depart: dateStringSchema,
    ville: z.string().trim().min(1).max(150).optional(),
  })
  .refine((data) => data.depart > data.arrivee, {
    message: "La date de départ doit être ultérieure à la date d'arrivée",
    path: ['depart'],
  });
