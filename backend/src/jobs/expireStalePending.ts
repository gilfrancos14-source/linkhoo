/**
 * Expire automatiquement les réservations en attente qui dépassent 24h.
 *
 * Ce job s'exécute périodiquement pour expirer les réservations en attente
 * qui n'ont pas été traitées par le gérant dans les 24 heures, libérant ainsi
 * les calendriers pour de nouvelles réservations.
 */

import { supabaseAdmin } from '../config/supabase';
import { logger } from '../lib/logger';

export async function expireStalePending(): Promise<void> {
  try {
    logger.info('[expireStalePending] Début du job d\'expiration des réservations en attente');
    
    const { count, error } = await supabaseAdmin.rpc('expire_stale_pending_reservations', {
      p_ttl_hours: 24,
    });
    
    if (error) {
      logger.error('[expireStalePending] Erreur lors de l\'exécution:', error.message);
      throw error;
    }
    
    if (count && count > 0) {
      logger.info(`[expireStalePending] ${count} réservation(s) en attente expirée(s)`);
      
      // Notifier les clients concernés
      const { data: reservations, error: fetchError } = await supabaseAdmin
        .from('reservations')
        .select('id, client_email, room_title, date_debut, date_fin')
        .in('id', (await supabaseAdmin
          .from('reservations')
          .select('id')
          .eq('statut', 'annulee')
          .eq('annulee_reason', 'stale_pending')
          .limit(count)
        ).data?.map(r => r.id) || []);
      
      if (fetchError) {
        logger.error('[expireStalePending] Erreur lors de la récupération des réservations expirées:', fetchError.message);
      } else if (reservations && reservations.length > 0) {
        // TODO: Envoyer des notifications emails aux clients concernés
        logger.info(`[expireStalePending] ${reservations.length} notification(s) email(s) à envoyer`);
      }
    } else {
      logger.info('[expireStalePending] Aucune réservation en attente à expirer');
    }
  } catch (error) {
    logger.error('[expireStalePending] Échec du job:', error instanceof Error ? error.message : error);
    throw error;
  }
}