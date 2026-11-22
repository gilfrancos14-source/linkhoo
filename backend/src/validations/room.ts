import { z } from 'zod';
import { dateStringSchema, marketSchema, optionalTextSafe, withoutPhoneNumber } from './common';
import { legacyImageUrlSchema, platformImageUrlSchema } from './imageUrl';

/**
 * Champs communs création / mise à jour. Les images utilisent ici le schéma
 * de compatibilité : une mise à jour doit pouvoir renvoyer telles quelles les
 * URLs historiques déjà enregistrées (`/images/…`, ancien Supabase).
 * La route PUT vérifie en plus que toute URL non-plateforme appartient déjà à
 * l'annonce (voir `routes/rooms.ts`), donc aucune nouvelle URL historique ne
 * peut être injectée.
 */
const roomFields = {
  title: withoutPhoneNumber(z.string().trim().min(1).max(200)),
  subtitle: optionalTextSafe(300),
  info: optionalTextSafe(300),
  price: z.string().trim().min(1).max(50),
  price_num: z.number().int().positive().max(1000000000),
  price_unit: z.enum(['/ mois', '/ nuit']),
  img: legacyImageUrlSchema,
  alt: optionalTextSafe(300),
  images: z.array(legacyImageUrlSchema).min(1).max(3),
  description: withoutPhoneNumber(z.string().trim().min(1).max(10000)),
  capacity: optionalTextSafe(100),
  category: withoutPhoneNumber(z.string().trim().min(1).max(200)),
  market: marketSchema,
  pays: withoutPhoneNumber(z.string().trim().min(1).max(100)),
  ville: withoutPhoneNumber(z.string().trim().min(1).max(150)),
  quartier: withoutPhoneNumber(z.string().trim().min(1).max(200)),
  chambres: z.number().int().positive().max(100),
  douches: z.number().int().positive().max(100),
  disponible: z.boolean(),
  date_dispo: z.string().trim().max(50).optional().default(''),
  conditions: withoutPhoneNumber(z.string().trim().min(1).max(5000)),
  is_popular: z.boolean().optional().default(false),
  promo_group: z.enum(['promo_15', 'promo_10', 'promo_5']).nullable().optional(),
  promo_start: z.string().nullable().optional(),
  promo_end: z.string().nullable().optional(),
};

/**
 * Création : uniquement des photos issues de NOTRE stockage (donc passées par
 * le contrôle de pertinence). Empêche de référencer une photo stock du site,
 * une image externe ou la photo d'un autre gérant sans téléversement.
 */
export const roomCreateSchema = z
  .object({
    ...roomFields,
    img: platformImageUrlSchema,
    images: z.array(platformImageUrlSchema).min(1).max(3),
  })
  .strict();

export const roomUpdateSchema = z.object(roomFields).partial().strict();

/**
 * Filtres acceptés par `/api/rooms/available`. En plus des dates, on peut
 * filtrer côté serveur (quartier, catégorie, budget) pour ne pas télécharger
 * tout le catalogue quand la page de recherche applique ses filtres.
 * La ville reste traitée à part : le routeur fait une correspondance
 * normalisée (accents/casse) avec repli par préfixe.
 */
export const roomAvailableQuerySchema = z
  .object({
    market: marketSchema.optional(),
    arrivee: dateStringSchema,
    depart: dateStringSchema,
    ville: z.string().trim().min(1).max(150).optional(),
    quartier: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(200).optional(),
    prix_min: z.coerce.number().min(0).max(1000000000).optional(),
    prix_max: z.coerce.number().min(0).max(1000000000).optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .refine((data) => data.depart > data.arrivee, {
    message: "La date de départ doit être ultérieure à la date d'arrivée",
    path: ['depart'],
  })
  .refine((data) => data.prix_min === undefined || data.prix_max === undefined || data.prix_min <= data.prix_max, {
    message: 'prix_min doit être inférieur ou égal à prix_max',
    path: ['prix_min'],
  });

/**
 * Filtres serveur de GET /api/rooms : la liste n'est plus téléchargée en
 * entier pour être filtrée côté client. Sans `page`/`limit`, la route garde
 * l'ancien comportement (tableau complet, filtres éventuels appliqués).
 */
export const roomListQuerySchema = z
  .object({
    market: marketSchema.optional(),
    ville: z.string().trim().min(1).max(150).optional(),
    quartier: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(200).optional(),
    prix_min: z.coerce.number().min(0).max(1000000000).optional(),
    prix_max: z.coerce.number().min(0).max(1000000000).optional(),
    chambres: z.coerce.number().int().min(1).max(100).optional(),
    disponible: z.enum(['true', 'false']).optional(),
    promo_group: z.enum(['promo_15', 'promo_10', 'promo_5']).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((data) => data.prix_min === undefined || data.prix_max === undefined || data.prix_min <= data.prix_max, {
    message: 'prix_min doit être inférieur ou égal à prix_max',
    path: ['prix_min'],
  });
