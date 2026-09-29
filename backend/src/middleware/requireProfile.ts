import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

type AllowedRole = 'client' | 'gerant';

export function requireProfile(role: AllowedRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = req.auth?.userId;
      if (!authUserId) {
        return res.status(401).json({ error: 'Non autorisé' });
      }

      const table = role === 'client' ? 'clients' : 'gerants';
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('id')
        .eq('clerk_user_id', authUserId)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        const roleLabel = role === 'gerant' ? 'gérant' : 'client';
        return res.status(403).json({
          error: `Accès réservé aux comptes ${roleLabel}`,
          role,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
