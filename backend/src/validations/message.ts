import { z } from 'zod';
import { idSchema, idParamsSchema } from './common';

export const conversationCreateSchema = z
  .object({
    room_id: idSchema,
  })
  .strict();

export const messageSendSchema = z
  .object({
    body: z.string().trim().min(1, 'Le message ne peut pas être vide').max(2000),
  })
  .strict();

// Pagination façon admin_reservations : page >= 1, limit bornée.
export const messagePageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const inboxQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  })
  .strict();

export const conversationParamsSchema = idParamsSchema;
