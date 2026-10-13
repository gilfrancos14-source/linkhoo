import { z } from 'zod';
import { ADMIN_PERMISSION_KEYS } from '../config/adminPermissions';

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
}).strict();

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
}).strict();

export const adminPermissionKeySchema = z.enum(ADMIN_PERMISSION_KEYS);

const adminNameSchema = z.string().trim().min(1).max(100);

/** POST /api/admin/admins — création d'un compte par le superadmin. */
export const adminCreateSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(200),
  nom: adminNameSchema,
  prenom: adminNameSchema,
  permissions: z.array(adminPermissionKeySchema).max(ADMIN_PERMISSION_KEYS.length).default([]),
}).strict();

/** PATCH /api/admin/admins/:id — au moins un champ à mettre à jour. */
export const adminUpdateSchema = z.object({
  email: z.string().trim().email().max(255).optional(),
  password: z.string().min(6).max(200).optional(),
  nom: adminNameSchema.optional(),
  prenom: adminNameSchema.optional(),
  permissions: z.array(adminPermissionKeySchema).max(ADMIN_PERMISSION_KEYS.length).optional(),
  is_superadmin: z.boolean().optional(),
}).strict().refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  { message: 'Aucun champ à mettre à jour' },
);

/**
 * Query de GET /api/admin/reservations — délègue le filtrage et la
 * pagination à la RPC admin_reservations (P1 #7).
 */
export const adminReservationsQuerySchema = z.object({
  statut: z.enum(['en_attente', 'confirmee', 'annulee', 'all']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
