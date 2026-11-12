import { supabaseAdmin } from '../config/supabase';

/**
 * P1 #8 — Publication des « réveils » Realtime (Supabase Broadcast).
 *
 * Le backend notifie uniquement qu'une liste de notifications a changé :
 * le contenu reste dans la base et le frontend reinterroge l'API (qui gère
 * l'authentification Clerk). Un canal public broadcast ne touche donc ni la
 * RLS (les tables notifications/client_notifications n'ont aucune politique
 * SELECT publique) ni les données sensibles (emails) — seule la survenue
 * d'un changement quitte le serveur, jamais son contenu.
 *
 * Depuis la migration PostgreSQL, Supabase Realtime n'existe plus : la
 * publication devient un no-op. Le frontend interroge déjà les listes toutes
 * les 30 s, aucun client n'écoute ces canaux. Les appels sont conservés pour
 * ne pas modifier une dizaine de routes, et le pilote `DB_DRIVER=supabase`
 * réactive l'ancien comportement (rollback).
 */
export type NotificationAudience = 'admin' | 'gerant' | 'client';

/** Sous-ensemble du canal Realtime réellement utilisé. */
interface BroadcastChannel {
  subscribe(): unknown;
  send(payload: unknown): Promise<{ error?: unknown }> | unknown;
}

/** Canal par public, créé une seule fois puis réutilisé (abonnement partagé). */
const channels = new Map<NotificationAudience, BroadcastChannel>();

function realtimeEnabled(): boolean {
  const client = supabaseAdmin as unknown as { channel?: unknown };
  return typeof client.channel === 'function';
}

function channelFor(audience: NotificationAudience): BroadcastChannel | null {
  if (!realtimeEnabled()) return null;
  try {
    const client = supabaseAdmin as unknown as {
      channel?: (name: string) => BroadcastChannel;
    };
    // Les doubles de test n'ont pas `channel` : pas de Realtime à publier,
    // mais surtout jamais d'erreur dans les routes.
    if (typeof client.channel !== 'function') return null;
    let channel = channels.get(audience);
    if (!channel) {
      channel = client.channel(`ilehya:notifications:${audience}`);
      // L'abonnement est asynchrone : le premier envoi peut échouer tant que
      // la socket n'est pas jointe (les clients retombent alors sur le
      // polling 30 s en attendant l'événement suivant).
      void channel.subscribe();
      channels.set(audience, channel);
    }
    return channel;
  } catch {
    return null;
  }
}

/**
 * Prévient les fronts connectés qu'une liste de notifications vient de
 * changer. Ne doit JAMAIS faire échouer la requête qui a créé la
 * notification : toute erreur est journalisée puis ignorée (le polling de
 * secours des clients couvre le retard).
 */
export async function publishNotificationChanged(
  ...audiences: NotificationAudience[]
): Promise<void> {
  for (const audience of audiences) {
    try {
      const channel = channelFor(audience);
      if (!channel) continue;
      const result = (await channel.send({
        type: 'broadcast',
        event: 'changed',
        payload: {},
      })) as { error?: unknown } | undefined;
      if (result?.error) {
        console.error(
          '[realtime] publication impossible:',
          audience,
          result.error instanceof Error ? result.error.message : result.error,
        );
      }
    } catch (err) {
      console.error(
        '[realtime] publication impossible:',
        audience,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
