import rateLimit from 'express-rate-limit';

export const createClientLimiter = (options?: { limit?: number }) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options?.limit ?? 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
  });
