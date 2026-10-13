import { z } from 'zod';
import { MARKET_CODES } from '../config/markets';
import { containsPhoneNumber, PHONE_IN_TEXT_ERROR } from '../utils/phoneInText';

export const marketSchema = z.enum(MARKET_CODES);

export const idSchema = z.string().trim().min(1).max(200);

export const emailSchema = z
  .string()
  .trim()
  .email()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Email invalide')
  .max(255)
  .transform((value) => value.toLowerCase());

// Date.parse « répare » les jours hors mois (2026-02-30 → 2 mars) : on
// reconstruit la date en UTC et on compare année/mois/jour pour rejeter le
// roulage silencieux.
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
  .refine((value) => {
    if (Number.isNaN(Date.parse(value))) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Date invalide');

export const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

/**
 * Champ texte lu publiquement (description, conditions) : les coordonnées
 * téléphoniques sont refusées, le contact passe par la messagerie de la
 * plateforme (profil gérant pour le téléphone vérifié).
 */
export const withoutPhoneNumber = <T extends z.ZodString>(schema: T) =>
  schema.refine((value) => !containsPhoneNumber(value), { message: PHONE_IN_TEXT_ERROR });

export const marketQuerySchema = z.object({
  market: marketSchema.optional(),
});

export const idParamsSchema = z.object({
  id: idSchema,
});
