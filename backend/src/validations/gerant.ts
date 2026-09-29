import { z } from 'zod';
import { marketSchema, emailSchema } from './common';

export const gerantCreateSchema = z
  .object({
    clerk_user_id: z.string().trim().min(1).max(200),
    email: emailSchema,
    nom: z.string().trim().max(100).optional().default(''),
    prenom: z.string().trim().max(100).optional().default(''),
    market: marketSchema,
  })
  .strict();

export const gerantUpdateSchema = z
  .object({
    nom: z.string().trim().max(100).optional(),
    prenom: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    market: marketSchema.optional(),
  })
  .strict();

export const verificationDocumentTypeSchema = z.enum([
  'national_id',
  'selfie',
  'id_card_front',
  'id_card_back',
]);

export const propertyAddressSchema = z
  .object({
    maps_url: z.string().trim().min(1).max(2000),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.lat === undefined && data.lng === undefined) ||
      (data.lat !== undefined && data.lng !== undefined),
    {
      message: 'lat et lng doivent être fournis ensemble',
    },
  );

export const verificationReviewSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    rejection_reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const verificationRejectSchema = z
  .object({
    rejection_reason: z.string().trim().min(1).max(500),
  })
  .strict();
