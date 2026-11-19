#!/usr/bin/env tsx

/**
 * Script de migration « données » pour la sécurité des réservations.
 *
 * Le schéma et les fonctions SQL sont appliqués par `npm run migrate`
 * (migrations 0040 et 0041). Ce script se contente d'exécuter une fois les
 * fonctions d'expiration sur les données existantes, de manière idempotente.
 *
 * Il repose sur SUPABASE_DB_URL / DATABASE_URL via l'adaptateur `supabaseAdmin`
 * (l'API Supabase n'est pas requise : le projet tourne sur PostgreSQL local).
 */

import 'dotenv/config';
import { supabaseAdmin } from '../src/config/supabase';
import { logger } from '../src/lib/logger';

async function migrateReservationSecurity() {
  logger.info('Début de la migration de sécurité des réservations');

  try {
    // 1. Expirer les réservations confirmées non payées depuis plus de 24h
    logger.info("Exécution de l'expiration des réservations confirmées non payées");
    const { count: expiredCount, error: expireError } = await supabaseAdmin.rpc(
      'expire_unpaid_confirmed_reservations',
      { p_payment_timeout_hours: 24 },
    );

    if (expireError) {
      logger.error("Erreur lors de l'expiration des réservations confirmées:", expireError);
      throw expireError;
    }

    if (expiredCount && expiredCount > 0) {
      logger.info(`${expiredCount} réservation(s) confirmée(s) non payée(s) ont été annulée(s)`);
    } else {
      logger.info('Aucune réservation confirmée non payée à expirer');
    }

    // 2. Expirer les réservations en attente depuis plus de 24h
    logger.info("Exécution de l'expiration des réservations en attente périmées");
    const { count: staleCount, error: staleError } = await supabaseAdmin.rpc(
      'expire_stale_pending_reservations',
      { p_ttl_hours: 24 },
    );

    if (staleError) {
      logger.error("Erreur lors de l'expiration des réservations en attente:", staleError);
      throw staleError;
    }

    if (staleCount && staleCount > 0) {
      logger.info(`${staleCount} réservation(s) en attente périmée(s) ont été annulée(s)`);
    } else {
      logger.info('Aucune réservation en attente à expirer');
    }

    // 3. Contrôle des quotas (diagnostic, non bloquant)
    const { data: pendingReservations, error: pendingError } = await supabaseAdmin
      .from('reservations')
      .select('id, client_email, room_id, created_at')
      .eq('statut', 'en_attente')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (pendingError) {
      logger.error('Erreur lors de la vérification des quotas:', pendingError);
      throw pendingError;
    }

    const clientRoomCounts = new Map<string, number>();
    const roomCounts = new Map<string, number>();
    pendingReservations?.forEach((reservation) => {
      const key = `${reservation.client_email}-${reservation.room_id}`;
      clientRoomCounts.set(key, (clientRoomCounts.get(key) || 0) + 1);
      roomCounts.set(reservation.room_id, (roomCounts.get(reservation.room_id) || 0) + 1);
    });

    let excessCount = 0;
    clientRoomCounts.forEach((count, key) => {
      if (count > 2) {
        excessCount++;
        logger.warn(`Client/chambre ${key} a ${count} réservations en attente (limite: 2)`);
      }
    });
    roomCounts.forEach((count, roomId) => {
      if (count > 5) {
        excessCount++;
        logger.warn(`Chambre ${roomId} a ${count} réservations en attente (limite: 5)`);
      }
    });
    if (excessCount > 0) {
      logger.warn(`${excessCount} dépassements de limites détectés (données antérieures à la migration)`);
    }

    logger.info('Migration de sécurité des réservations terminée avec succès');
  } catch (error) {
    logger.error('Échec de la migration:', error instanceof Error ? error.message : error);
    throw error;
  }
}

migrateReservationSecurity()
  .then(() => {
    logger.info('Migration complétée');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration échouée:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
