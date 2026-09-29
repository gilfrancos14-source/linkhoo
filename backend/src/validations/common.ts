import { z } from 'zod';

export const marketSchema = z.enum(['CI', 'BJ']);

export const idSchema = z.string().trim().min(1).max(200);

export const emailSchema = z
  .string()
  .trim()
  .email()
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

export const marketQuerySchema = z.object({
  market: marketSchema.optional(),
});

export const idParamsSchema = z.object({
  id: idSchema,
});
