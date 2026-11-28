import { z } from 'zod';
import { idSchema, optionalText, withoutPhoneNumber } from './common';

const noteSchema = z.number().int().min(1).max(5);

/** Les six critères affichés sur la fiche chambre. Optionnels pour les avis historiques. */
export const REVIEW_SCORE_KEYS = [
  'note_proprete',
  'note_exactitude',
  'note_arrivee',
  'note_communication',
  'note_emplacement',
  'note_rapport_qualite_prix',
] as const;

export const reviewCreateSchema = z
  .object({
    reservation_id: idSchema,
    note_appartement: noteSchema,
    note_gerant: noteSchema,
    commentaire: withoutPhoneNumber(optionalText(2000)),
    note_proprete: noteSchema.nullable().optional(),
    note_exactitude: noteSchema.nullable().optional(),
    note_arrivee: noteSchema.nullable().optional(),
    note_communication: noteSchema.nullable().optional(),
    note_emplacement: noteSchema.nullable().optional(),
    note_rapport_qualite_prix: noteSchema.nullable().optional(),
  })
  .strict();

export const reviewRoomQuerySchema = z
  .object({
    room_id: idSchema,
    lang: z.enum(['fr', 'en', 'es']).optional(),
  })
  .strict();
