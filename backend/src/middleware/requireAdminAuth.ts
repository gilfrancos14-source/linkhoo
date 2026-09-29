import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RequestAdminInfo } from '../types/express';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET!;

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Partial<RequestAdminInfo>;
    if (!hasAdminClaims(payload)) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    req.admin = payload as RequestAdminInfo;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
