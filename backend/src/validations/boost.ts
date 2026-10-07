import { z } from 'zod';
import { idSchema } from './common';
import {
  BOOST_BUDGETS,
  BOOST_MAX_DURATION_DAYS,
  BOOST_START_GRACE_MS,
} from '../config/boosts';

// UUID généré par la base (gen_random_uuid) : format vérifié pour rejeter
// tôt les ids invalides qui feraient échouer la RPC (22P02).
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Identifiant invalide');

// Fenêtre de dates commune création / reprogrammation.
const windowFields = {
  starts_at: z.coerce.date(),
  ends_at: z.coerce.date(),
};

function refineWindow(
  data: { starts_at: Date; ends_at: Date },
  context: { addIssue: (issue: { code: typeof z.ZodIssueCode.custom; path: (string | number)[]; message: string }) => void }
): void {
  const addIssue = (path: ('starts_at' | 'ends_at')[], message: string) => {
    context.addIssue({ code: z.ZodIssueCode.custom, path, message });
  };

  const start = data.starts_at.getTime();
  const end = data.ends_at.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    addIssue(['starts_at'], 'Date invalide');
    return;
  }
  if (start < Date.now() - BOOST_START_GRACE_MS) {
    addIssue(['starts_at'], 'La date de début ne peut pas être dans le passé');
  }
  if (end <= start) {
    addIssue(['ends_at'], 'La date de fin doit être postérieure à la date de début');
  } else if (end - start > (BOOST_MAX_DURATION_DAYS + 0.5) * 24 * 60 * 60 * 1000) {
    // m11 : le client envoie la fin à 23:59:59 du dernier jour — une fenêtre
    // D → D+90 dure 90 j + 11:59:59, on garde « 90 jours entre début et fin »
    // en accordant la demi-journée de fin (le front valide à l'identique).
    addIssue(['ends_at'], `La campagne ne peut pas durer plus de ${BOOST_MAX_DURATION_DAYS} jours`);
  }
}

export const boostInitiateSchema = z
  .object({
    room_id: idSchema,
    mode: z.enum(['cpc', 'cpi']),
    budget_total: z.union([z.literal(BOOST_BUDGETS[0]), z.literal(BOOST_BUDGETS[1]), z.literal(BOOST_BUDGETS[2])]),
    ...windowFields,
  })
  .strict()
  .superRefine(refineWindow);

export const boostScheduleSchema = z
  .object(windowFields)
  .strict()
  .superRefine(refineWindow);

export const boostTrackSchema = z
  .object({
    boost_id: uuidSchema,
    visitor_id: z.string().trim().min(8).max(64),
  })
  .strict();

export const boostConfirmSchema = z
  .object({
    transaction_id: z.coerce.number().int().positive(),
  })
  .strict();
