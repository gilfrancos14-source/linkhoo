import { z } from 'zod';
import { marketSchema, optionalText } from './common';

const imageUrlSchema = z.string().trim().min(1).max(2048);

export const categoryCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    img: imageUrlSchema,
    alt: optionalText(300),
    market: marketSchema,
  })
  .strict();

export const categoryUpdateSchema = categoryCreateSchema.partial().strict();
