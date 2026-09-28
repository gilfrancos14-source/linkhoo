import { z } from 'zod';
import { dateStringSchema, emailSchema, idSchema, optionalText } from './common';

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === '' || /^[\d\s+()-]{6,}$/.test(value), 'Numéro de téléphone invalide')
  .optional()
  .default('');

export const reservationCreateSchema = z
  .object({
    client_name: z.string().trim().min(1).max(200),
    client_email: emailSchema,
    client_phone: phoneSchema,
    room_id: idSchema,
    room_title: z.string().trim().min(1).max(300),
    date_debut: dateStringSchema,
    date_fin: dateStringSchema,
    montant: z.number().int().positive().max(1000000000),
    message: optionalText(2000),
  })
  .strict()
  .superRefine((data, context) => {
    if (new Date(data.date_fin) <= new Date(data.date_debut)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date_fin'],
        message: 'La date de fin doit être après la date de début',
      });
    }
  });

export const reservationStatusSchema = z
  .object({
    statut: z.enum(['confirmee', 'annulee']),
  })
  .strict();

export const reservationCheckQuerySchema = z
  .object({
    room_id: idSchema,
    date_debut: dateStringSchema,
    date_fin: dateStringSchema,
    exclude_id: idSchema.optional(),
  })
  .strict()
  .superRefine((data, context) => {
    if (new Date(data.date_fin) <= new Date(data.date_debut)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date_fin'],
        message: 'La date de fin doit être après la date de début',
      });
    }
  });

export const clientReservationQuerySchema = z
  .object({
    email: emailSchema.optional(),
  })
  .strict();
