import { z } from 'zod';
import { idSchema } from './common';
import {
  BOOST_MAX_DURATION_DAYS,
  BOOST_MAX_BUDGET,
  BOOST_MIN_BUDGET,
  BOOST_PRICE_CPI,
  BOOST_PRICE_CPC,
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

/**
 * Budget multiple du pas de facturation du mode : 50 F en cpc, 5 F en cpi.
 * Sans cela, un budget « rond » mais non multiple (ex. 3 010 F en cpc)
 * s'épuise en laissant un reliquat que le gérant a payé sans le consommer.
 */
function refineBudget(
  data: { mode: 'cpc' | 'cpi'; budget_total: number },
  context: { addIssue: (issue: { code: typeof z.ZodIssueCode.custom; path: (string | number)[]; message: string }) => void }
): void {
  if ((data.mode !== 'cpc' && data.mode !== 'cpi') || !Number.isInteger(data.budget_total)) return;
  const step = data.mode === 'cpc' ? BOOST_PRICE_CPC : BOOST_PRICE_CPI;
  const unit = data.mode === 'cpc' ? 'un clic' : 'une impression';
  if (data.budget_total % step !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['budget_total'],
      message: `Le budget doit être un multiple de ${step} FCFA (${unit})`,
    });
  }
}

export const boostInitiateSchema = z
  .object({
    room_id: idSchema,
    mode: z.enum(['cpc', 'cpi']),
    // Budget libre saisi par le gérant : entier, pas de facturation, borné
    // serveur (borne de CRÉATION — la borne d'acceptation reste large).
    budget_total: z
      .number()
      .int('Le budget doit être un nombre entier')
      .min(BOOST_MIN_BUDGET, `Le budget minimum est de ${BOOST_MIN_BUDGET} FCFA`)
      .max(BOOST_MAX_BUDGET, `Le budget maximum est de ${BOOST_MAX_BUDGET} FCFA`),
    ...windowFields,
  })
  .strict()
  .superRefine(refineWindow)
  .superRefine(refineBudget);

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
