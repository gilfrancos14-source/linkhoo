import { supabaseAdmin } from '../config/supabase';

/** Rétention des notifications (décision P1 #8) : 30 jours. */
export const NOTIFICATION_RETENTION_DAYS = 30;

/** Fréquence de la purge côté backend : une fois par jour. */
export const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Appelle la RPC `purge_old_notifications()` (migration 0009) pour supprimer
 * les notifications/client_notifications plus vieilles que la rétention.
 * Ne lève jamais : la purge est de la maintenance, elle ne doit pas faire
 * échouer une requête ni planter le process.
 */
export async function purgeOldNotifications(
  retentionDays: number = NOTIFICATION_RETENTION_DAYS,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin.rpc('purge_old_notifications', {
      p_retention_days: retentionDays,
    });
    if (error) {
      console.error('[purge] purge des notifications impossible:', error.message);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { notifications_deleted?: number; client_notifications_deleted?: number }
      | null
      | undefined;
    const deleted =
      Number(row?.notifications_deleted ?? 0) + Number(row?.client_notifications_deleted ?? 0);
    if (deleted > 0) {
      console.log(`[purge] ${deleted} notification(s) purgée(s) (> ${retentionDays} j)`);
    }
  } catch (err) {
    console.error(
      '[purge] purge des notifications impossible:',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Démarre la purge quotidienne. Premier nettoyage après `initialDelayMs`
 * (5 min : le démarrage reste consacré au service), puis toutes les 24 h.
 * Les timers sont unref pour ne jamais retenir le process Node ouvert.
 * Retourne la fonction d'arrêt (utile en test et pour l'arrêt propre).
 */
export function startNotificationPurge(
  options: { initialDelayMs?: number; intervalMs?: number } = {},
): () => void {
  const initialDelayMs = options.initialDelayMs ?? 5 * 60 * 1000;
  const intervalMs = options.intervalMs ?? PURGE_INTERVAL_MS;
  const run = () => {
    void purgeOldNotifications();
  };
  const first = setTimeout(run, initialDelayMs);
  const periodic = setInterval(run, intervalMs);
  first.unref();
  periodic.unref();
  return () => {
    clearTimeout(first);
    clearInterval(periodic);
  };
}
