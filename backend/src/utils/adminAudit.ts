import type { Request, Response } from 'express';

export interface AdminAuditEntry {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  method?: string | null;
  path?: string | null;
  status?: number | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Journal d'audit admin (best-effort) : une ligne par mutation sensible.
 *
 * L'insertion est asynchrone et n'échoue jamais la requête métier — un audit
 * indisponible ne doit pas casser une action déjà appliquée. Les erreurs sont
 * seulement logguées.
 */
export function logAdminAction(entry: AdminAuditEntry): void {
  // Les tests unitaires ne doivent pas ouvrir de connexion base.
  if (process.env.VITEST) return;

  // Import paresseux : évite de charger la config Supabase au simple import du
  // middleware (les tests de `requireAdminAuth` n'ont pas besoin de la base).
  void import('../config/supabase')
    .then(({ supabaseAdmin }) =>
      supabaseAdmin
        .from('admin_audit_log')
        .insert({
          admin_id: entry.adminId ?? null,
          admin_email: entry.adminEmail ?? null,
          action: entry.action,
          method: entry.method ?? null,
          path: entry.path ?? null,
          status: entry.status ?? null,
          ip: entry.ip ?? null,
          user_agent: entry.userAgent ?? null,
        })
        .then(({ error }) => {
          if (error) console.warn('[admin-audit] insertion impossible :', error.message);
        }),
    )
    .catch((error: unknown) => {
      console.warn('[admin-audit] module Supabase indisponible :', error);
    });
}

/**
 * Branche le journal sur la fin de toute requête admin mutante (non-GET).
 * Appelé une seule fois par requête, depuis `requireAdminAuth`.
 */
export function attachAdminAudit(req: Request, res: Response, adminId: string, adminEmail: string): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;

  res.on('finish', () => {
    logAdminAction({
      adminId,
      adminEmail,
      action: `${req.method} ${req.path}`,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  });
}
