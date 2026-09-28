import { Request, Response, NextFunction } from 'express';

interface StatusError {
  status?: unknown;
  statusCode?: unknown;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('Erreur serveur:', err instanceof Error ? err.message : err);

  const candidate = err as StatusError;
  const raw = typeof candidate?.status === 'number' ? candidate.status : candidate?.statusCode;
  const status = typeof raw === 'number' && raw >= 400 && raw < 600 ? raw : 500;

  res.status(status).json({
    error: status === 500 ? 'Erreur interne du serveur' : (err instanceof Error ? err.message : 'Requête invalide'),
  });
}
