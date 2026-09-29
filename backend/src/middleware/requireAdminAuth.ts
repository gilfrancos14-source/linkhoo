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
    const payload = jwt.verify(token, JWT_SECRET) as RequestAdminInfo;
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export function signAdminToken(payload: RequestAdminInfo): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
