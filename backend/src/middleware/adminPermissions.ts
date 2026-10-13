import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { isPermissionKey } from '../config/adminPermissions';
import type { RequestAdminPerms } from '../types/express';

/**
 * Lit is_superadmin + permissions en base (une seule fois par requête, caché
 * sur req) : une révocation est donc effective immédiatement, sans attendre
 * l'expiration du JWT. À monter APRÈS requireAdminAuth.
 */
async function loadAdminPerms(req: Request): Promise<RequestAdminPerms | null> {
  if (req.adminPerms) return req.adminPerms;

  const adminId = req.admin?.adminId;
  if (!adminId) return null;

  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('is_superadmin, permissions')
    .eq('id', adminId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const perms = new Set(
    Array.isArray(data.permissions) ? data.permissions.filter(isPermissionKey) : [],
  );
  const loaded: RequestAdminPerms = { isSuper: Boolean(data.is_superadmin), perms };
  req.adminPerms = loaded;
  return loaded;
}

/** Autorise le superadmin ou un admin portant la clé de la section. */
export function requirePermission(cle: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = await loadAdminPerms(req);
      if (perms && (perms.isSuper || perms.perms.has(cle))) {
        return next();
      }
      return res.status(403).json({ error: 'Permission refusée' });
    } catch (err) {
      next(err);
    }
  };
}

/** Réservé au superadmin (gestion de l'équipe notamment). */
export async function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  try {
    const perms = await loadAdminPerms(req);
    if (perms?.isSuper) {
      return next();
    }
    return res.status(403).json({ error: 'Permission refusée' });
  } catch (err) {
    next(err);
  }
}
