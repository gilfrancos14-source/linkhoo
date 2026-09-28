import { z } from 'zod';
import { idSchema, optionalText } from './common';

export const reviewCreateSchema = z
  .object({
    reservation_id: idSchema,
    note_appartement: z.number().int().min(1).max(5),
    note_gerant: z.number().int().min(1).max(5),
    commentaire: optionalText(2000),
  })
  .strict();

export const reviewRoomQuerySchema = z
  .object({
    room_id: idSchema,
  })
  .strict();
