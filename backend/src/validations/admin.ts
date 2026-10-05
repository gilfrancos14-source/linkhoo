import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
}).strict();

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
}).strict();

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
