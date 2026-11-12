import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../config/supabase';
import { closePool, query } from './pool';

/**
 * Tests d'intégration de l'adaptateur PostgreSQL, exécutés sur une VRAIE base.
 *
 * Ils sont ignorés si `DATABASE_URL` n'est pas défini (CI sans base) :
 *
 *   cd backend
 *   DATABASE_URL=postgresql://ilehya:ilehya_dev_password@localhost:5434/ilehya \
 *     npx vitest run src/db/postgrest.integration.test.ts
 *
 * Ils écrivent dans `reservations` et suppriment tout ce qu'ils ont créé.
 */

const connectionString = process.env.DATABASE_URL;
const describeIntegration = connectionString ? describe : describe.skip;

// Les tests touchent une vraie base (catalogues système, verrous) : le
// délai par défaut de 5 s est trop court sur une machine chargée.
vi.setConfig({ testTimeout: 30_000 });

const RESERVATION_ID = 'it-postgrest-reservation';
let roomId: string | null = null;

describeIntegration('adaptateur PostgreSQL (intégration)', () => {
  beforeAll(async () => {
    await query('DELETE FROM reservations WHERE id = $1', [RESERVATION_ID]);
    const { rows } = await query<{ id: string }>(
      'SELECT id FROM rooms ORDER BY id LIMIT 1',
    );
    roomId = rows[0]?.id ?? null;
    if (roomId) {
      await query(
        `INSERT INTO reservations
           (id, client_name, client_email, room_id, room_title, date_debut, date_fin,
            montant, duree_nombre, duree_unite, statut)
         VALUES ($1, 'Intégration', 'it@example.test', $2, 'Chambre test',
                 '2031-01-01', '2031-02-01', 12345, 1, 'mois', 'en_attente')`,
        [RESERVATION_ID, roomId],
      );
    }
  });

  afterAll(async () => {
    await query('DELETE FROM reservations WHERE id = $1', [RESERVATION_ID]);
    await closePool();
  });

  it('lit une table et renvoie un tableau de lignes', async () => {
    const { data, error } = await supabaseAdmin.from('rooms').select('id, title');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('applique eq, order et range', async () => {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('market', 'CI')
      .order('id', { ascending: true })
      .range(0, 4);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeLessThanOrEqual(5);
  });

  it('renvoie un compte exact avec head', async () => {
    const { data, error, count } = await supabaseAdmin
      .from('rooms')
      .select('id', { count: 'exact', head: true });
    expect(error).toBeNull();
    expect(data).toBeNull();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('filtre avec in, not et or', async () => {
    const { data: withIn } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .in('market', ['CI', 'BJ']);
    expect(withIn?.length).toBeGreaterThan(0);

    const { data: withNot } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .not('room_id', 'is', null);
    expect(Array.isArray(withNot)).toBe(true);

    const { data: withOr, error: orError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .or('market.eq.CI,market.eq.BJ');
    expect(orError).toBeNull();
    expect(withOr?.length).toBeGreaterThan(0);
  });

  it('insère, met à jour puis supprime avec RETURNING', async () => {
    const inserted = await supabaseAdmin
      .from('reservations')
      .insert({
        id: `${RESERVATION_ID}-2`,
        client_name: 'Insertion',
        client_email: 'it2@example.test',
        montant: 100,
      })
      .select('id, montant')
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.montant).toBe(100);

    const updated = await supabaseAdmin
      .from('reservations')
      .update({ statut: 'confirmee' })
      .eq('id', `${RESERVATION_ID}-2`)
      .select('id, statut')
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data?.statut).toBe('confirmee');

    const removed = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', `${RESERVATION_ID}-2`)
      .select('id');
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);
  });

  it('applique upsert avec onConflict', async () => {
    const payload = {
      id: 'it-postgrest-room',
      title: 'Chambre intégration',
      market: 'CI',
      price_num: 100,
      price_unit: '/ mois',
    };

    const first = await supabaseAdmin
      .from('rooms')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);

    // Second passage : la ligne existe, `ignoreDuplicates` doit neutraliser
    // le conflit sans erreur.
    const second = await supabaseAdmin
      .from('rooms')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    expect(second.error).toBeNull();

    await query('DELETE FROM rooms WHERE id = $1', ['it-postgrest-room']);
  });

  it('distingue single (erreur si 0 ligne) et maybeSingle (null)', async () => {
    const single = await supabaseAdmin.from('reservations').select('id').eq('id', 'absent').single();
    expect(single.error?.code).toBe('PGRST116');

    const maybe = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('id', 'absent')
      .maybeSingle();
    expect(maybe.error).toBeNull();
    expect(maybe.data).toBeNull();
  });

  it('rattache une ressource imbriquée (alias)', async () => {
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('id, room_id, room:rooms(img, alt, description)')
      .eq('id', RESERVATION_ID);
    expect(error).toBeNull();
    const row = (data ?? [])[0] as any;
    expect(row.room).not.toBeNull();
    expect(row.room).toHaveProperty('img');
    // La clé de jointure ajoutée par l'adaptateur ne doit pas fuiter.
    expect(Object.keys(row.room)).not.toContain('id');
  });

  it('rattache une ressource imbriquée avec !inner', async () => {
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('*, rooms!inner(gerant_id, disponible)')
      .eq('id', RESERVATION_ID);
    expect(error).toBeNull();
    const row = (data ?? [])[0] as any;
    expect(row).toBeDefined();
    expect(row.rooms).not.toBeNull();
  });

  it('conserve les types comme PostgREST (montant en nombre, date en texte)', async () => {
    const { data } = await supabaseAdmin
      .from('reservations')
      .select('montant, created_at, refunded_amount')
      .eq('id', RESERVATION_ID)
      .single();
    expect(typeof data?.montant).toBe('number');
    expect(typeof data?.refunded_amount).toBe('number');
    expect(typeof data?.created_at).toBe('string');
    // Format ISO exact de PostgREST (séparateur « T », décalage « +00:00 »).
    expect(data?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('appelle une fonction SETOF (create_reservation_checked)', async () => {
    const id = 'it-postgrest-reservation-rpc';
    await query('DELETE FROM reservations WHERE id = $1', [id]);

    const base = {
      p_id: id,
      p_client_name: 'Intégration',
      p_client_email: 'it@example.test',
      p_client_phone: null,
      p_room_title: 'Chambre test',
      p_date_debut: '2031-03-01',
      p_date_fin: '2031-04-01',
      p_montant: 50000,
      p_duree_nombre: 1,
      p_duree_unite: 'mois',
      p_client_key: null,
    };

    // Chambre inconnue : la fonction lève une exception, l'erreur doit être
    // remontée telle quelle (le code route la teste sur son message).
    const missing = await supabaseAdmin.rpc('create_reservation_checked', {
      ...base,
      p_room_id: 'chambre-inexistante',
    });
    expect(missing.error).not.toBeNull();
    expect(missing.error?.message).toContain('ROOM_NOT_FOUND');

    if (!roomId) return;

    const created = await supabaseAdmin.rpc('create_reservation_checked', {
      ...base,
      p_room_id: roomId,
    });
    expect(created.error).toBeNull();
    expect(Array.isArray(created.data)).toBe(true);
    expect((created.data as any[])[0]?.client_email).toBe('it@example.test');

    await query('DELETE FROM reservations WHERE id = $1', [id]);
  });

  it('appelle une fonction JSONB, scalaire et tabulaire', async () => {
    const stats = await supabaseAdmin.rpc('admin_stats');
    expect(stats.error).toBeNull();
    expect(typeof stats.data).toBe('object');

    const unread = await supabaseAdmin.rpc('messages_unread_total', {
      p_clerk_user_id: 'user_integration',
      p_side: 'client',
    });
    expect(unread.error).toBeNull();
    expect(typeof unread.data).toBe('number');

    const listing = await supabaseAdmin.rpc('admin_reservations', {
      p_statut: null,
      p_search: null,
      p_page: 1,
      p_limit: 5,
    });
    expect(listing.error).toBeNull();
    expect(typeof listing.data).toBe('object');
  });
});
