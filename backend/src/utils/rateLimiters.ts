import rateLimit from 'express-rate-limit';

export const createClientLimiter = (options?: { limit?: number }) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options?.limit ?? 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
    // Les limites ne visent que les écritures : un GET (section avis de la
    // home, liste de notifications pollée toutes les 30 s…) ne doit jamais
    // renvoyer de 429 à un utilisateur qui navigue normalement.
    skip: (req) => req.method === 'GET',
  });
