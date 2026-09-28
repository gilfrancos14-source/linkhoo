import { z } from 'zod';
import { marketSchema, optionalText } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

export const bannerCreateSchema = z
  .object({
    section: z.enum(['popular', 'promos', 'categories', 'events']),
    img: imageUrlSchema,
    alt: optionalText(300),
    link: z.string().trim().min(1).max(2048),
    market: marketSchema,
    order: z.number().int().min(0).max(10000),
  })
  .strict();

export const bannerUpdateSchema = bannerCreateSchema.partial().strict();
