/**
 * Annule automatiquement les réservations confirmées non payées après 24h.
 *
 * Ce job s'exécute périodiquement pour libérer les calendriers des réservations
 * confirmées mais non payées, empêchant ainsi les clients de bloquer des annonces
 * sans effectuer le paiement.
 */

import { supabaseAdmin } from '../config/supabase';
import { logger } from '../lib/logger';

export async function expireUnpaidConfirmed(): Promise<void> {
  try {
    logger.info('[expireUnpaidConfirmed] Début du job d\'annulation des réservations confirmées non payées');
    
    const { count, error } = await supabaseAdmin.rpc('expire_unpaid_confirmed_reservations', {
      p_payment_timeout_hours: 24,
    });
    
    if (error) {
      logger.error('[expireUnpaidConfirmed] Erreur lors de l\'exécution:', error.message);
      throw error;
    }
    
    if (count && count > 0) {
      logger.info(`[expireUnpaidConfirmed] ${count} réservation(s) confirmée(s) non payée(s) annulée(s)`);
      
      // Notifier les clients concernés
      const { data: reservations, error: fetchError } = await supabaseAdmin
        .from('reservations')
        .select('id, client_email, room_title, date_debut, date_fin')
        .in('id', (await supabaseAdmin
          .from('reservations')
          .select('id')
          .eq('statut', 'annulee')
          .eq('annulee_reason', 'payment_timeout')
          .limit(count)
        ).data?.map(r => r.id) || []);
      
      if (fetchError) {
        logger.error('[expireUnpaidConfirmed] Erreur lors de la récupération des réservations annulées:', fetchError.message);
      } else if (reservations && reservations.length > 0) {
        // TODO: Envoyer des notifications emails aux clients concernés
        logger.info(`[expireUnpaidConfirmed] ${reservations.length} notification(s) email(s) à envoyer`);
      }
    } else {
      logger.info('[expireUnpaidConfirmed] Aucune réservation confirmée non payée à annuler');
    }
  } catch (error) {
    logger.error('[expireUnpaidConfirmed] Échec du job:', error instanceof Error ? error.message : error);
    throw error;
  }
}