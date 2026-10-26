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

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      date.getTime() < Date.now()
    );
  }, 'Date de naissance invalide');

export const gerantUpdateSchema = z
  .object({
    nom: z.string().trim().max(100).optional(),
    prenom: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    address: z.string().trim().max(300).optional(),
    date_of_birth: isoDateSchema.optional(),
    nationality: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const verificationDocumentTypeSchema = z.enum([
  'national_id',
  'proof_of_address',
  'selfie',
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
