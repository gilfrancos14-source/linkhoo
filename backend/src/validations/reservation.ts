import { z } from 'zod';
import { dateStringSchema, emailSchema, idSchema, optionalText } from './common';
import { computeDateFin, DUREE_MAX_MOIS, DUREE_MAX_NUIT, type DureeUnite } from '../utils/duration';

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
    duree_nombre: z.number().int().min(1).max(1000000),
    duree_unite: z.enum(['nuit', 'mois']),
    montant: z.number().int().positive().max(1000000000),
    message: optionalText(2000),
  })
  .strict()
  .superRefine((data, context) => {
    const addIssue = (path: ('duree_nombre' | 'date_fin')[], message: string) => {
      context.addIssue({ code: z.ZodIssueCode.custom, path, message });
    };

    // 1. Plafond de durée selon l'unité (366 nuits / 24 mois).
    if (typeof data.duree_nombre === 'number' && Number.isInteger(data.duree_nombre)) {
      const max = data.duree_unite === 'mois' ? DUREE_MAX_MOIS : DUREE_MAX_NUIT;
      if (data.duree_nombre > max) {
        addIssue(['duree_nombre'], `La durée ne peut pas dépasser ${max} ${data.duree_unite}(s)`);
      }
    }

    // 2. L'ordre des dates reste vérifié (message historique conservé).
    if (new Date(data.date_fin) <= new Date(data.date_debut)) {
      addIssue(['date_fin'], 'La date de fin doit être après la date de début');
    }

    // 3. date_fin doit être EXACTEMENT date_debut + durée : le client calcule,
    //    le serveur vérifie (source de vérité pour les conflits de disponibilité).
    const datesValid =
      dateStringSchema.safeParse(data.date_debut).success &&
      dateStringSchema.safeParse(data.date_fin).success;
    const dureeValid =
      typeof data.duree_nombre === 'number' &&
      (data.duree_unite === 'nuit' || data.duree_unite === 'mois');
    if (datesValid && dureeValid) {
      const expected = computeDateFin(data.date_debut, data.duree_nombre, data.duree_unite as DureeUnite);
      if (expected !== data.date_fin) {
        addIssue(
          ['date_fin'],
          `La date de fin doit correspondre à la durée demandée (${data.duree_nombre} ${data.duree_unite}(s) → ${expected})`,
        );
      }
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
