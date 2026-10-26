import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RequestAdminInfo } from '../types/express';
import { ADMIN_COOKIE_NAME, readCookie } from '../utils/adminCookie';
import { attachAdminAudit } from '../utils/adminAudit';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET!;

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // F4 : le cookie HttpOnly est le transport nominal. Le Bearer reste accepté
  // pour les clients API et les tests, jamais pour le navigateur.
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = bearer ?? readCookie(req, ADMIN_COOKIE_NAME);

  if (!token) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as Partial<RequestAdminInfo>;
    if (!hasAdminClaims(payload)) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    req.admin = payload as RequestAdminInfo;
    attachAdminAudit(req, res, payload.adminId!, payload.email!);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// La signature seule ne suffit pas : un jeton Clerk signé avec le même secret
// n'a ni adminId ni email et ne doit pas ouvrir l'accès admin.
function hasAdminClaims(payload: Partial<RequestAdminInfo> | null | undefined): boolean {
  return (
    typeof payload?.adminId === 'string' &&
    payload.adminId.trim().length > 0 &&
    typeof payload.email === 'string' &&
    payload.email.trim().length > 0
  );
}

export function signAdminToken(payload: RequestAdminInfo): string {
  // F4 : fenêtre réduite (une journée de travail) pour limiter l'impact d'un
  // jeton dérobé ; la session reste en mémoire d'onglet côté client.
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}
