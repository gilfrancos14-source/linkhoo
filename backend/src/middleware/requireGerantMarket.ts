import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export async function requireGerantMarket(
  req: Request,
  res: Response,
  opts: { requireVerified?: boolean } = {},
): Promise<{ market: string; userId: string } | null> {
  const requireVerified = opts.requireVerified !== false;
  const authUserId = req.auth?.userId;
  if (!authUserId) {
    res.status(401).json({ error: 'Non autorisé' });
    return null;
  }
  const { data: gerant, error } = await supabaseAdmin
    .from('gerants')
    .select('market, is_verified')
    .eq('clerk_user_id', authUserId)
    .maybeSingle();
  if (error || !gerant || (requireVerified && !gerant.is_verified)) {
    res.status(403).json({ error: 'Seuls les gérants vérifiés peuvent effectuer cette action' });
    return null;
  }
  return { market: gerant.market, userId: authUserId };
}
