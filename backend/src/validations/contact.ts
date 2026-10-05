import { z } from 'zod';
import { emailSchema, marketSchema, optionalText } from './common';

// Liste des pays alignée sur la page contact de référence (CoinAfrique) —
// faute d'origine « Caméroun » corrigée. Les valeurs sont stockées telles
// quelles dans contact_messages.pays (voir migration 0010).
export const PAYS_CONTACT = [
  'Bénin',
  'Burkina Faso',
  'Cameroun',
  'Congo',
  "Côte d'Ivoire",
  'Gabon',
  'Guinée',
  'Mali',
  'Niger',
  'RDC',
  'Sénégal',
  'Togo',
] as const;

export const SUJETS_CONTACT = [
  'reservation',
  'compte-gerant',
  'partenariat',
  'presse',
  'autre',
] as const;

export const contactPaysSchema = z.enum(PAYS_CONTACT, { message: 'Pays invalide.' });
export const contactSujetSchema = z.enum(SUJETS_CONTACT, { message: 'Sujet invalide.' });

export const contactMessageSchema = z
  .object({
    nom: z.string().trim().min(1, 'Le nom est requis.').max(100),
    prenom: optionalText(100),
    email: emailSchema,
    telephone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 .()-]{6,20}$/, 'Numéro de téléphone invalide.')
      .optional()
      .default(''),
    pays: contactPaysSchema,
    sujet: contactSujetSchema,
    message: z
      .string()
      .trim()
      .min(10, 'Le message doit contenir au moins 10 caractères.')
      .max(2000, 'Le message ne peut pas dépasser 2000 caractères.'),
    market: marketSchema.optional(),
    // Champ pot de miel : resté vide par un humain, rempli par un robot.
    website: z.string().max(50).optional().default(''),
  })
  .strict();

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
