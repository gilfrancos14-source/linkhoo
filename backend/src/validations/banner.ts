import { z } from 'zod';
import { marketSchema, optionalText } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

export const bannerCreateSchema = z
  .object({
    section: z.enum(['popular', 'promos', 'categories', 'events', 'hero']),
    img: imageUrlSchema,
    alt: optionalText(300),
    // Lien de clic : optionnel, SANS défaut — `partial()` est utilisé pour
    // l'update, et un défaut écraserait le lien existant à chaque PUT.
    // Une bannière peut être purement visuelle (aucun `<a>` dans le landing).
    link: z.string().trim().max(2048).optional(),
    market: marketSchema,
    order: z.number().int().min(0).max(10000),
  })
  .strict();

export const bannerUpdateSchema = bannerCreateSchema.partial().strict();
