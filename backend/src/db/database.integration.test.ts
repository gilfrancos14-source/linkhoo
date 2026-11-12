import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../config/supabase';
import { closePool, query } from './pool';

/**
 * Tests d'intégration du backend sur une VRAIE base PostgreSQL.
 *
 * Tout est regroupé dans un seul fichier : les tests d'intégration se
 * chevauchent (verrous, données partagées) et ne doivent pas tourner en
 * parallèle les uns des autres.
 *
 * Contenu :
 *  1. adaptateur de compatibilité (CRUD, filtres, count, ressources
 *     imbriquées, formats de types) ;
 *  2. parcours de paiement (premium, réservation, remboursement) ;
 *  3. balayage des RPC utilisées par le backend ;
 *  4. intégrité des corps de fonctions SQL.
 *
 * Ils sont ignorés si DATABASE_URL n'est pas défini.
 */

const connectionString = process.env.DATABASE_URL;
const describeIntegration = connectionString ? describe : describe.skip;

// Chaque pool de test est limité : plusieurs fichiers ouverts en parallèle
// satureraient les connexions du PostgreSQL de développement.
process.env.DATABASE_POOL_MAX ??= '4';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 90_000 });

const CLERK_ID = 'it_gerant_paiement';
const GERANT_EMAIL = 'it-gerant-paiement@test.ci';
const PREMIUM_REFERENCE = 'PAY-ITPREMIUM0001';
const BOOKING_REFERENCE = 'PAY-ITBOOKING0001';
const RESERVATION_ID = 'it-reservation-paiement';
const UNKNOWN_REFERENCE = 'PAY-ITINCONNU0001';

let roomId: string | null = null;

async function cleanUpPayments(): Promise<void> {
  await query(
    'DELETE FROM payment_refunds WHERE payment_id IN (SELECT id FROM payments WHERE reference IN ($1, $2))',
    [PREMIUM_REFERENCE, BOOKING_REFERENCE],
  );
  await query('DELETE FROM payments WHERE reference IN ($1, $2)', [PREMIUM_REFERENCE, BOOKING_REFERENCE]);
  await query('DELETE FROM reservations WHERE id = $1', [RESERVATION_ID]);
  await query('DELETE FROM gerants WHERE clerk_user_id = $1', [CLERK_ID]);
}

// ---------------------------------------------------------------------------
// 1. Adaptateur de compatibilité
// ---------------------------------------------------------------------------

describeIntegration('adaptateur PostgreSQL', () => {
  beforeAll(async () => {
    await query('DELETE FROM reservations WHERE id = $1', [RESERVATION_ID]);
    const { rows } = await query<{ id: string }>('SELECT id FROM rooms ORDER BY id LIMIT 1');
    roomId = rows[0]?.id ?? null;
    await query(
      `INSERT INTO reservations (id, client_name, client_email, room_id, room_title,
                                 date_debut, date_fin, montant, duree_nombre, duree_unite, statut)
       VALUES ($1, 'Intégration', 'it@example.test', $2, 'Chambre test',
               '2031-01-01', '2031-02-01', 12345, 1, 'mois', 'en_attente')`,
      [RESERVATION_ID, roomId],
    );
  });

  afterAll(async () => {
    await query('DELETE FROM reservations WHERE id = $1', [RESERVATION_ID]);
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
    const { data: withIn } = await supabaseAdmin.from('rooms').select('id').in('market', ['CI', 'BJ']);
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

    const maybe = await supabaseAdmin.from('reservations').select('id').eq('id', 'absent').maybeSingle();
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

  it('conserve les types comme PostgREST', async () => {
    const { data } = await supabaseAdmin
      .from('reservations')
      .select('montant, created_at, refunded_amount')
      .eq('id', RESERVATION_ID)
      .single();
    expect(typeof data?.montant).toBe('number');
    expect(typeof data?.refunded_amount).toBe('number');
    expect(typeof data?.created_at).toBe('string');
    expect(data?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('appelle une fonction SETOF (create_reservation_checked)', async () => {
    const id = `${RESERVATION_ID}-rpc`;
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

    const missing = await supabaseAdmin.rpc('create_reservation_checked', {
      ...base,
      p_room_id: 'chambre-inexistante',
    });
    expect(missing.error).not.toBeNull();
    expect(missing.error?.message).toContain('ROOM_NOT_FOUND');

    if (!roomId) return;

    const created = await supabaseAdmin.rpc('create_reservation_checked', { ...base, p_room_id: roomId });
    expect(created.error).toBeNull();
    expect(Array.isArray(created.data)).toBe(true);
    expect((created.data as any[])[0]?.client_email).toBe('it@example.test');

    await query('DELETE FROM reservations WHERE id = $1', [id]);
  });
});

// ---------------------------------------------------------------------------
// 2. Parcours de paiement
// ---------------------------------------------------------------------------

describeIntegration('parcours de paiement', () => {
  beforeAll(async () => {
    await cleanUpPayments();

    const { rows } = await query<{ id: string }>('SELECT id FROM rooms ORDER BY id LIMIT 1');
    roomId = rows[0]?.id ?? null;

    await query(
      `INSERT INTO gerants (id, clerk_user_id, email, nom, prenom, market, is_premium)
       VALUES (gen_random_uuid(), $1, $2, 'Intégration', 'Paiement', 'BJ', false)`,
      [CLERK_ID, GERANT_EMAIL],
    );

    await query(
      `INSERT INTO reservations (id, client_name, client_email, room_id, room_title,
                                 date_debut, date_fin, montant, duree_nombre, duree_unite,
                                 statut, payment_status)
       VALUES ($1, 'Intégration', 'it@test.ci', $2, 'Chambre test',
               '2033-01-01', '2033-02-01', 5000, 1, 'mois', 'confirmee', 'pending')`,
      [RESERVATION_ID, roomId],
    );
  });

  afterAll(async () => {
    await cleanUpPayments();
  });

  it('active un abonnement premium et renvoie le marché', async () => {
    await query(
      `INSERT INTO payments (id, reference, purpose, provider, provider_payment_id, payer_type,
                             gerant_clerk_user_id, market, amount, currency, amount_xof, status, metadata)
       VALUES (gen_random_uuid(), $1, 'premium', 'pawapay', 'prov_it_premium', 'gerant',
               $2, 'BJ', 5000, 'XOF', 5000, 'pending', '{}'::jsonb)`,
      [PREMIUM_REFERENCE, CLERK_ID],
    );

    const result = await supabaseAdmin.rpc('payment_claim_premium', {
      p_reference: PREMIUM_REFERENCE,
      p_provider_payment_id: 'prov_it_premium',
      p_amount: 5000,
      p_currency: 'XOF',
      p_days: 30,
    });

    expect(result.error).toBeNull();
    const row = (result.data as any[])[0];
    expect(row.already_claimed).toBe(false);
    // La colonne qui manquait : sans elle, toute activation premium échouait.
    expect(row.market).toBe('BJ');
    expect(row.gerant_clerk_user_id).toBe(CLERK_ID);
    expect(new Date(row.new_expires_at).getTime()).toBeGreaterThan(Date.now());

    const gerant = await query<{ is_premium: boolean; premium_expires_at: string }>(
      'SELECT is_premium, premium_expires_at FROM gerants WHERE clerk_user_id = $1',
      [CLERK_ID],
    );
    expect(gerant.rows[0].is_premium).toBe(true);
    expect(gerant.rows[0].premium_expires_at).toBeTruthy();

    const payment = await query<{ status: string; fulfilled_at: string | null }>(
      'SELECT status, fulfilled_at FROM payments WHERE reference = $1',
      [PREMIUM_REFERENCE],
    );
    expect(payment.rows[0].status).toBe('succeeded');
    expect(payment.rows[0].fulfilled_at).toBeTruthy();
  });

  it('ne prolonge pas l’abonnement quand le paiement est rejoué', async () => {
    const before = await query<{ premium_expires_at: string }>(
      'SELECT premium_expires_at FROM gerants WHERE clerk_user_id = $1',
      [CLERK_ID],
    );

    const replay = await supabaseAdmin.rpc('payment_claim_premium', {
      p_reference: PREMIUM_REFERENCE,
      p_provider_payment_id: 'prov_it_premium',
      p_amount: 5000,
      p_currency: 'XOF',
      p_days: 30,
    });

    expect(replay.error).toBeNull();
    expect((replay.data as any[])[0].already_claimed).toBe(true);

    const after = await query<{ premium_expires_at: string }>(
      'SELECT premium_expires_at FROM gerants WHERE clerk_user_id = $1',
      [CLERK_ID],
    );
    expect(after.rows[0].premium_expires_at).toBe(before.rows[0].premium_expires_at);
  });

  it('refuse un montant incohérent sur un paiement neuf', async () => {
    const reference = 'PAY-ITMISMATCH0001';
    await query(
      `INSERT INTO payments (id, reference, purpose, provider, provider_payment_id, payer_type,
                             gerant_clerk_user_id, market, amount, currency, amount_xof, status, metadata)
       VALUES (gen_random_uuid(), $1, 'premium', 'pawapay', 'prov_it_mismatch', 'gerant',
               $2, 'BJ', 5000, 'XOF', 5000, 'pending', '{}'::jsonb)`,
      [reference, CLERK_ID],
    );

    const result = await supabaseAdmin.rpc('payment_claim_premium', {
      p_reference: reference,
      p_provider_payment_id: 'prov_it_mismatch',
      p_amount: 9999,
      p_currency: 'XOF',
      p_days: 30,
    });

    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain('AMOUNT_MISMATCH');

    await query('DELETE FROM payments WHERE reference = $1', [reference]);
  });

  it('marque la réservation payée quand le paiement est réclamé', async () => {
    await query(
      `INSERT INTO payments (id, reference, purpose, provider, provider_payment_id, payer_type,
                             reservation_id, gerant_clerk_user_id, market, amount, currency,
                             amount_xof, status, metadata)
       VALUES (gen_random_uuid(), $1, 'booking', 'pawapay', 'prov_it_booking', 'client',
               $2, $3, 'BJ', 5000, 'XOF', 5000, 'pending', '{}'::jsonb)`,
      [BOOKING_REFERENCE, RESERVATION_ID, CLERK_ID],
    );

    const result = await supabaseAdmin.rpc('payment_claim_booking', {
      p_reference: BOOKING_REFERENCE,
      p_provider_payment_id: 'prov_it_booking',
      p_amount: 5000,
      p_currency: 'XOF',
    });

    expect(result.error).toBeNull();
    const row = (result.data as any[])[0];
    expect(row.reservation_id).toBe(RESERVATION_ID);
    expect(row.already_claimed).toBe(false);
    expect(row.market).toBe('BJ');

    const reservation = await query<{ payment_status: string }>(
      'SELECT payment_status FROM reservations WHERE id = $1',
      [RESERVATION_ID],
    );
    expect(reservation.rows[0].payment_status).toBe('paid');
  });

  it('enregistre une demande de remboursement et refuse le double', async () => {
    const payment = await query<{ id: string }>(
      'SELECT id FROM payments WHERE reference = $1',
      [BOOKING_REFERENCE],
    );

    const first = await supabaseAdmin.rpc('payment_request_refund', {
      p_payment_id: payment.rows[0].id,
      p_amount: 2000,
      p_reason: 'client_cancellation',
      p_requested_by: 'admin_test',
      p_reason_details: 'demande de remboursement de test',
      p_policy_snapshot: { source: 'test', commission_percent: 0, deposit_percent: 100 },
    });

    expect(first.error).toBeNull();
    const row = (first.data as any[])[0];
    expect(row.refund_id).toBeTruthy();
    expect(Number(row.remaining)).toBe(3000);

    const refund = await query<{ amount: string; status: string; reason: string }>(
      'SELECT amount, status, reason FROM payment_refunds WHERE id = $1',
      [row.refund_id],
    );
    expect(Number(refund.rows[0].amount)).toBe(2000);
    expect(refund.rows[0].status).toBe('requested');
    expect(refund.rows[0].reason).toBe('client_cancellation');

    const tooMuch = await supabaseAdmin.rpc('payment_request_refund', {
      p_payment_id: payment.rows[0].id,
      p_amount: 4000,
      p_reason: 'client_cancellation',
      p_requested_by: 'admin_test',
      p_reason_details: 'second demande',
      p_policy_snapshot: { source: 'test', commission_percent: 0, deposit_percent: 100 },
    });
    expect(tooMuch.error).not.toBeNull();
    expect(tooMuch.error?.message).toContain('REFUND_EXCEEDS_PAYMENT');

    const reservation = await query<{ refunded_amount: string; payment_status: string }>(
      'SELECT refunded_amount, payment_status FROM reservations WHERE id = $1',
      [RESERVATION_ID],
    );
    expect(Number(reservation.rows[0].refunded_amount)).toBe(2000);
    expect(reservation.rows[0].payment_status).toBe('partially_refunded');
  });
});

// ---------------------------------------------------------------------------
// 3. Balayage des RPC
// ---------------------------------------------------------------------------

interface RpcCase {
  name: string;
  fn: string;
  args: Record<string, unknown>;
  shape: 'table' | 'scalar';
}

const RPC_CASES: RpcCase[] = [
  { name: 'admin_stats', fn: 'admin_stats', args: {}, shape: 'scalar' },
  {
    name: 'admin_reservations',
    fn: 'admin_reservations',
    args: { p_statut: null, p_search: null, p_page: 1, p_limit: 5 },
    shape: 'scalar',
  },
  {
    name: 'messages_inbox',
    fn: 'messages_inbox',
    args: { p_clerk_user_id: 'user_test', p_side: 'client', p_page: 1, p_limit: 5 },
    shape: 'scalar',
  },
  {
    name: 'messages_unread_total',
    fn: 'messages_unread_total',
    args: { p_clerk_user_id: 'user_test', p_side: 'client' },
    shape: 'scalar',
  },
  { name: 'purge_old_notifications', fn: 'purge_old_notifications', args: { p_retention_days: 30 }, shape: 'table' },
  {
    name: 'has_date_conflict',
    fn: 'has_date_conflict',
    args: {
      p_room_id: 'chambre-inexistante',
      p_date_debut: '2033-01-01',
      p_date_fin: '2033-02-01',
      p_exclude_id: null,
    },
    shape: 'scalar',
  },
  {
    name: 'expire_stale_pending_reservations',
    fn: 'expire_stale_pending_reservations',
    args: { p_ttl_hours: 48 },
    shape: 'scalar',
  },
  {
    name: 'activate_premium_checked',
    fn: 'activate_premium_checked',
    args: { p_transaction_id: '00000000-0000-4000-8000-0000000000ff', p_days: 30 },
    shape: 'table',
  },
  {
    name: 'activate_boost_checked',
    fn: 'activate_boost_checked',
    args: { p_transaction_id: '00000000-0000-4000-8000-0000000000ff' },
    shape: 'table',
  },
  {
    name: 'charge_boost',
    fn: 'charge_boost',
    args: {
      p_boost_id: '00000000-0000-4000-8000-0000000000ff',
      p_kind: 'visit',
      p_visitor_id: 'visitor_test',
      p_amount: 100,
    },
    shape: 'table',
  },
  {
    name: 'payment_claim_booking',
    fn: 'payment_claim_booking',
    args: {
      p_reference: UNKNOWN_REFERENCE,
      p_provider_payment_id: 'provider_test',
      p_amount: 1000,
      p_currency: 'XOF',
    },
    shape: 'table',
  },
  {
    name: 'payment_claim_premium',
    fn: 'payment_claim_premium',
    args: {
      p_reference: UNKNOWN_REFERENCE,
      p_provider_payment_id: 'provider_test',
      p_amount: 1000,
      p_currency: 'XOF',
      p_days: 30,
    },
    shape: 'table',
  },
  {
    name: 'payment_claim_succeeded',
    fn: 'payment_claim_succeeded',
    args: {
      p_reference: UNKNOWN_REFERENCE,
      p_provider_payment_id: 'provider_test',
      p_amount: 1000,
      p_currency: 'XOF',
    },
    shape: 'table',
  },
  {
    name: 'payment_request_refund',
    fn: 'payment_request_refund',
    args: {
      p_payment_id: '00000000-0000-4000-8000-0000000000ff',
      p_amount: 500,
      p_reason: 'client_cancellation',
      p_requested_by: 'admin_test',
      p_reason_details: 'test',
      p_policy_snapshot: { source: 'test', commission_percent: 0, deposit_percent: 100 },
    },
    shape: 'table',
  },
  { name: 'payment_cancel_refund', fn: 'payment_cancel_refund', args: { p_refund_id: '00000000-0000-4000-8000-0000000000ff' }, shape: 'table' },
];

const PLUMBING_ERROR =
  /does not exist|cannot be cast|syntax error|is not a function|too few arguments|ambiguous|no function matches/i;

describeIntegration('RPC du backend', () => {
  for (const testCase of RPC_CASES) {
    it(`${testCase.name} s’exécute correctement`, async () => {
      const result = await supabaseAdmin.rpc(testCase.fn, testCase.args);

      if (result.error) {
        // Une erreur de règle métier prouve que la fonction a été appelée :
        // c'est un succès pour ce test. Seule une erreur de plomberie échoue.
        expect(
          result.error.message,
          `erreur de plomberie sur ${testCase.fn} : ${result.error.message}`,
        ).not.toMatch(PLUMBING_ERROR);
        return;
      }

      if (testCase.shape === 'table') {
        expect(Array.isArray(result.data)).toBe(true);
      } else {
        expect(
          result.data === null ||
            typeof result.data === 'object' ||
            typeof result.data === 'number' ||
            typeof result.data === 'boolean',
        ).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Intégrité des corps de fonctions SQL
// ---------------------------------------------------------------------------

interface FunctionInfo {
  name: string;
  args: { name: string; type: string }[];
}

function dummyValue(type: string): unknown {
  const t = type.toLowerCase();
  if (t.includes('uuid')) return '00000000-0000-4000-8000-0000000000ff';
  if (t.includes('json')) return {};
  if (t.includes('timestamp') || t.includes('date')) return new Date().toISOString();
  if (t.includes('int') || t.includes('numeric') || t.includes('decimal')) return 1;
  if (t.includes('bool')) return false;
  if (t.includes('[]')) return [];
  return 'x';
}

describeIntegration('intégrité des fonctions SQL', () => {
  let client: Client;
  let functions: FunctionInfo[] = [];

  beforeAll(async () => {
    client = new Client({ connectionString, application_name: 'ilehya-sql-sweep' });
    await client.connect();

    // `information_schema.parameters` ignore les fonctions dont le type de
    // retour est une table : on passe par pg_proc (pronargs = nombre
    // d'arguments ENTRANTS, proargnames aligné dessus).
    const { rows } = await client.query<{
      name: string;
      pronargs: number;
      proargnames: string[] | null;
      arg_oids: number[];
    }>(
      `SELECT p.proname AS name,
              p.pronargs,
              p.proargnames,
              p.proargtypes::oid[] AS arg_oids
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        ORDER BY p.proname, p.pronargs`,
    );

    const allOids = [...new Set(rows.flatMap((row) => row.arg_oids ?? []))];
    const typeNames = new Map<string, string>();
    if (allOids.length > 0) {
      const types = await client.query<{ oid: number; typname: string }>(
        'SELECT oid, typname FROM pg_type WHERE oid = ANY($1)',
        [allOids],
      );
      for (const type of types.rows) typeNames.set(String(type.oid), type.typname);
    }

    functions = rows.map((row) => {
      const names = row.proargnames ?? [];
      const oids = row.arg_oids ?? [];
      const args: { name: string; type: string }[] = [];
      for (let i = 0; i < row.pronargs; i += 1) {
        args.push({
          name: names[i] ?? `arg${i + 1}`,
          type: typeNames.get(String(oids[i])) ?? 'text',
        });
      }
      return { name: row.name, args };
    });
  });

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    await closePool();
  });

  it('exécute toutes les fonctions sans erreur de compilation', async () => {
    expect(functions.length).toBeGreaterThan(10);

    const broken: string[] = [];

    await client.query('BEGIN');
    try {
      for (const fn of functions) {
        const args = fn.args.map((arg, index) => `${arg.name} => $${index + 1}`);
        const values = fn.args.map((arg) => dummyValue(arg.type));

        await client.query('SAVEPOINT sweep');
        try {
          await client.query(`SELECT * FROM public."${fn.name}"(${args.join(', ')})`, values);
          await client.query('RELEASE SAVEPOINT sweep');
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT sweep');
          await client.query('RELEASE SAVEPOINT sweep');
          const message = (error as { message?: string }).message ?? '';
          if (PLUMBING_ERROR.test(message)) {
            broken.push(`${fn.name} : ${message}`);
          }
        }
      }
    } finally {
      // Tout ce qui a pu être écrit pendant le balayage est annulé.
      await client.query('ROLLBACK').catch(() => undefined);
    }

    expect(broken, `fonctions au corps cassé :\n${broken.join('\n')}`).toEqual([]);
  });
});
