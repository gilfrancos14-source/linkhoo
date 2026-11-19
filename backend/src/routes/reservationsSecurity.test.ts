import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';

// Configuration du test
const TEST_EMAIL = 'test-security@example.com';
const TEST_ROOM_ID = 'test-room-security';
const TEST_ROOM_TITLE = 'Test Room Security';
const TEST_GERANT_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Tests d'intégration des mesures anti-spam (migrations 0040-0042).
 * Ils nécessitent une base PostgreSQL locale (DATABASE_URL dans .env).
 */
describe('Sécurité des réservations', () => {
  beforeAll(async () => {
    const { error: gerantError } = await supabaseAdmin.from('gerants').insert({
      id: TEST_GERANT_ID,
      clerk_user_id: 'test-security-gerant',
      email: 'gerant-security@example.com',
      market: 'CI',
    });
    // Ignorer une éventuelle insertion déjà faite lors d'un run précédent
    if (gerantError && !gerantError.message.includes('duplicate')) throw gerantError;

    const { error: roomError } = await supabaseAdmin.from('rooms').upsert({
      id: TEST_ROOM_ID,
      title: TEST_ROOM_TITLE,
      market: 'CI',
      price_num: 10000,
      price_unit: 'par_nuit',
      disponible: true,
      // fk_rooms_gerant référence gerants(clerk_user_id), pas gerants(id)
      gerant_id: 'test-security-gerant',
    });
    if (roomError) {
      console.error('Erreur lors de la création de la chambre de test:', roomError);
      throw roomError;
    }
  });

  beforeEach(async () => {
    // Isoler chaque test : supprimer toutes les réservations de la chambre de test
    const { error } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('room_id', TEST_ROOM_ID);
    if (error) throw error;
  });

  afterAll(async () => {
    await supabaseAdmin.from('reservations').delete().eq('room_id', TEST_ROOM_ID);
    await supabaseAdmin.from('rooms').delete().eq('id', TEST_ROOM_ID);
    await supabaseAdmin.from('gerants').delete().eq('id', TEST_GERANT_ID);
  });

  function createReservation(email: string, debut: string, fin: string) {
    return supabaseAdmin.rpc('create_reservation_checked', {
      p_id: randomUUID(),
      p_client_name: 'Test Client',
      p_client_email: email,
      p_client_phone: '+2250700000000',
      p_room_id: TEST_ROOM_ID,
      p_room_title: TEST_ROOM_TITLE,
      p_date_debut: debut,
      p_date_fin: fin,
      p_montant: 50000,
    });
  }

  test('Devrait autoriser une réservation en attente sans bloquer les dates', async () => {
    const { data: first, error } = await createReservation(TEST_EMAIL, '2025-01-15', '2025-01-20');
    expect(error).toBeNull();
    expect((first as any[])[0].statut).toBe('en_attente');

    // Une seconde réservation d'un autre client sur les mêmes dates est acceptée
    // (les demandes en attente ne bloquent pas le calendrier).
    const { data: second, error: secondError } = await createReservation('test2@example.com', '2025-01-15', '2025-01-20');
    expect(secondError).toBeNull();
    expect((second as any[])[0].statut).toBe('en_attente');
  });

  test('Devrait bloquer plus de 2 réservations en attente par client et par chambre', async () => {
    await createReservation(TEST_EMAIL, '2025-02-15', '2025-02-20');
    await createReservation(TEST_EMAIL, '2025-03-15', '2025-03-20');

    const { error } = await createReservation(TEST_EMAIL, '2025-04-15', '2025-04-20');
    expect(error).toBeDefined();
    expect(error!.message).toContain('TOO_MANY_PENDING_PER_CLIENT_PER_ROOM');
  });

  test('Devrait bloquer plus de 5 réservations en attente par chambre', async () => {
    for (let i = 0; i < 5; i++) {
      const month = String(i + 1).padStart(2, '0');
      const { error } = await createReservation(`client${i}@example.com`, `2025-${month}-15`, `2025-${month}-20`);
      expect(error).toBeNull();
    }

    const { error } = await createReservation('client6@example.com', '2025-06-15', '2025-06-20');
    expect(error).toBeDefined();
    expect(error!.message).toContain('TOO_MANY_PENDING_PER_ROOM');
  });

  test('Devrait bloquer les dates pour les réservations confirmées', async () => {
    const { data: created } = await createReservation(TEST_EMAIL, '2025-05-15', '2025-05-20');
    const id = (created as any[])[0].id;

    const { data: confirmed } = await supabaseAdmin.rpc('confirm_reservation_checked', {
      p_reservation_id: id,
    });
    expect((confirmed as any[])[0].statut).toBe('confirmee');

    const { error } = await createReservation('test2@example.com', '2025-05-15', '2025-05-20');
    expect(error).toBeDefined();
    expect(error!.message).toContain('DATE_CONFLICT');
  });

  test('Devrait annuler automatiquement les réservations confirmées non payées après 24h', async () => {
    const { data: created } = await createReservation(TEST_EMAIL, '2025-07-15', '2025-07-20');
    const id = (created as any[])[0].id;
    await supabaseAdmin.rpc('confirm_reservation_checked', { p_reservation_id: id });

    const { data: confirmed } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();
    expect(confirmed.statut).toBe('confirmee');
    expect(confirmed.payment_status).toBe('unpaid');

    // Reculer responded_at de 25h pour simuler le délai dépassé
    const { error: backdateError } = await supabaseAdmin
      .from('reservations')
      .update({ responded_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
      .eq('id', id);
    expect(backdateError).toBeNull();

    const { data: count, error: expireError } = await supabaseAdmin.rpc(
      'expire_unpaid_confirmed_reservations',
      { p_payment_timeout_hours: 24 },
    );
    expect(expireError).toBeNull();
    expect(count).toBeGreaterThan(0);

    const { data: cancelled } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();
    expect(cancelled.statut).toBe('annulee');
    expect(cancelled.annulee_reason).toBe('payment_timeout');
  });
});
