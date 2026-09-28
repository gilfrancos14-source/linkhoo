import { z } from 'zod';
import { emailSchema, idSchema, optionalText } from './common';

const notificationTypeSchema = z.enum(['reservation', 'reservation_confirmed', 'reservation_rejected', 'verification_submitted', 'verification_approved', 'verification_rejected', 'reservation_cancelled']);

export const notificationCreateSchema = z
  .object({
    type: notificationTypeSchema,
    roomTitle: z.string().trim().min(1).max(300),
    roomId: idSchema,
    clientName: z.string().trim().min(1).max(200),
    clientEmail: emailSchema,
    clientPhone: z.string().trim().max(30).optional().default(''),
    message: optionalText(2000),
    reservationId: idSchema.optional(),
  })
  .strict();

export const clientNotificationCreateSchema = z
  .object({
    type: z.enum(['reservation_confirmed', 'reservation_rejected']),
    roomTitle: z.string().trim().min(1).max(300),
    roomId: idSchema,
    clientEmail: emailSchema,
    message: optionalText(2000),
  })
  .strict();
