import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
}).strict();

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
}).strict();
