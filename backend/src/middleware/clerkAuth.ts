import { verifyToken } from '@clerk/backend';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET!;
const CLOCK_SKEW_IN_MS = 60_000;

export async function requireClerkAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      clockSkewInMs: CLOCK_SKEW_IN_MS,
    });
    (req as any).auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      sessionClaims: payload,
    };
    next();
  } catch (err) {
    console.error('[clerkAuth] verifyToken failed:', err);
    return res.status(401).json({ error: 'Token d\'authentification invalide' });
  }
}

export async function requireClerkOrAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      clockSkewInMs: CLOCK_SKEW_IN_MS,
    });
    (req as any).auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      sessionClaims: payload,
    };
    return next();
  } catch {
    // Clerk failed, try admin JWT
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: string; email: string };
    (req as any).admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

/**
 * Vérifie le RÔLE, pas seulement la validité du jeton.
 * À chaîner APRÈS requireClerkOrAdminAuth, qui pose req.admin ou req.auth.
 * Utilisé par l'upload : admin (JWT admin) ou gérant (compte Clerk gérant).
 * Un simple client connecté est refusé.
 */
export async function requireAdminOrGerant(req: Request, res: Response, next: NextFunction) {
  if ((req as any).admin) return next();

  const authUserId = (req as any).auth?.userId as string | undefined;
  if (!authUserId) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(403).json({ error: 'Accès réservé aux comptes gérant' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
