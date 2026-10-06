// Tests des RPC de la migration 0013_boosts.sql contre la vraie base.
//
// Exécution : npm run test:boosts   (depuis backend/, SUPABASE_DB_URL requis)
//
// Tout tourne dans UNE transaction SANS COMMIT, systématiquement annulée en
// fin de parcours : aucun test ne pollue la base. Ce que les tests unitaires
// vitest ne peuvent pas voir (ils mockent Supabase) est ici vérifié sur le
// vrai plpgsql : débit, dédup, épuisement, fenêtre de dates, claim anti
// double-crédit, index partiel UNIQUE.
//
// Code de sortie 0 = tous les tests passent, 1 = au moins un échec.

import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

let passed = 0;
const failures = [];

function check(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  [ok] ${label}`);
  } else {
    failures.push(label);
    console.error(`  [ÉCHEC] ${label}`);
  }
}

function checkRow(row, expected, label) {
  const problems = [];
  for (const [key, value] of Object.entries(expected)) {
    if (row?.[key] !== value) problems.push(`${key}=${JSON.stringify(row?.[key])} (attendu ${JSON.stringify(value)})`);
  }
  check(problems.length === 0, problems.length === 0 ? label : `${label} — ${problems.join(', ')}`);
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL manquant dans backend/.env');
  }

  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    const gerant = await client.query(
      'SELECT clerk_user_id FROM gerants ORDER BY created_at LIMIT 1',
    );
    if (gerant.rows.length === 0) {
      throw new Error('Aucun gérant en base : impossible de tester les FK');
    }
    const clerkUserId = gerant.rows[0].clerk_user_id;

    const room = await client.query(
      `INSERT INTO rooms (title, market, gerant_id)
       VALUES ('RPC boost test (rollback)', 'CI', $1)
       RETURNING id`,
      [clerkUserId],
    );
    const roomId = room.rows[0].id;

    async function makeTransaction(fedapayId, type) {
      const { rows } = await client.query(
        `INSERT INTO premium_transactions
           (fedapay_transaction_id, clerk_user_id, market, amount, status, type)
         VALUES ($1, $2, 'CI', 1000, 'approved', $3)
         RETURNING id`,
        [fedapayId, clerkUserId, type],
      );
      return rows[0].id;
    }

    async function makeBoost(transactionId, overrides = {}) {
      const { rows } = await client.query(
        `INSERT INTO boosts
           (market, room_id, gerant_id, mode, budget_total, starts_at, ends_at, transaction_id, status)
         VALUES ('CI', $1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING id`,
        [
          roomId,
          clerkUserId,
          overrides.mode ?? 'cpi',
          overrides.budgetTotal ?? 25,
          overrides.startsAt ?? new Date(Date.now() - 3600_000),
          overrides.endsAt ?? new Date(Date.now() + 3600_000),
          transactionId,
        ],
      );
      return rows[0].id;
    }

    const charge = async (boostId, kind, visitor, amount) => {
      const { rows } = await client.query(
        'SELECT * FROM charge_boost($1, $2, $3, $4)',
        [boostId, kind, visitor, amount],
      );
      return rows[0];
    };

    // ---------------------------------------------------------------
    console.log('1. Activation (claim anti double-crédit)');
    // ---------------------------------------------------------------
    const tx1 = await makeTransaction(999999991, 'boost');
    const boost1 = await makeBoost(tx1);

    // Payée mais pas encore activée : le tracking ne facture rien.
    const before = await charge(boost1, 'impression', 'visitor-avant-1', 5);
    checkRow(before, { counted: false, billed: false }, 'campagne pending : rien ne se facture');

    const first = await client.query('SELECT * FROM activate_boost_checked($1)', [tx1]);
    checkRow(
      first.rows[0],
      { already_activated: false, boost_id: boost1 },
      'première activation : already_activated=false, bonne campagne',
    );

    const second = await client.query('SELECT * FROM activate_boost_checked($1)', [tx1]);
    checkRow(second.rows[0], { already_activated: true }, 'seconde activation : already_activated=true (webhook + confirm)');

    const status1 = await client.query(
      'SELECT status, spent FROM boosts WHERE id = $1',
      [boost1],
    );
    checkRow(status1.rows[0], { status: 'active', spent: 0 }, 'campagne active, budget intact après double activation');

    // ---------------------------------------------------------------
    console.log('2. Facturation + dédup visiteur (mode cpi, 5 F/imp)');
    // ---------------------------------------------------------------
    const imp1 = await charge(boost1, 'impression', 'visitor-alpha-1', 5);
    checkRow(imp1, { counted: true, billed: true, exhausted: false, remaining: 20 }, '1re impression facturée (spent=5, reste=20)');

    const imp1bis = await charge(boost1, 'impression', 'visitor-alpha-1', 5);
    checkRow(imp1bis, { counted: true, billed: false, exhausted: false, remaining: 20 }, 'même visiteur <10 min : compté, gratuit');

    const imp2 = await charge(boost1, 'impression', 'visitor-beta-2', 5);
    checkRow(imp2, { counted: true, billed: true, remaining: 15 }, 'autre visiteur : facturé (spent=10, reste=15)');

    const clickFree = await charge(boost1, 'click', 'visitor-alpha-1', 0);
    checkRow(clickFree, { counted: true, billed: false, remaining: 15 }, 'clic gratuit sur campagne cpi : compté, non facturé');

    // ---------------------------------------------------------------
    console.log('3. Épuisement de budget');
    // ---------------------------------------------------------------
    const impC = await charge(boost1, 'impression', 'visitor-gamma-3', 5);
    const impD = await charge(boost1, 'impression', 'visitor-delta-4', 5);
    const impE = await charge(boost1, 'impression', 'visitor-epsilon-5', 5);
    checkRow(impE, { counted: true, billed: true, remaining: 0 }, 'dernier franc exact : facturé, reste=0');
    check(
      [impC, impD, impE].every((r) => r.billed && !r.exhausted),
      'série d\'impressions jusqu\'au solde exact',
    );

    const impOver = await charge(boost1, 'impression', 'visitor-zeta-6', 5);
    checkRow(impOver, { counted: false, billed: false, exhausted: true }, 'budget insuffisant : épuisé, rien débité');

    const statusExhausted = await client.query(
      "SELECT status, spent FROM boosts WHERE id = $1",
      [boost1],
    );
    checkRow(statusExhausted.rows[0], { status: 'exhausted', spent: 25 }, 'statut exhausted en base, spent=25 (jamais 30)');

    const afterExhausted = await charge(boost1, 'impression', 'visitor-eta-7', 5);
    checkRow(afterExhausted, { counted: false, billed: false, exhausted: true }, 'après épuisement : plus rien ne se facture');

    // ---------------------------------------------------------------
    console.log('4. Fenêtre de dates + pause admin');
    // ---------------------------------------------------------------
    const tx2 = await makeTransaction(999999992, 'boost');
    const boost2 = await makeBoost(tx2, { budgetTotal: 100 });
    await client.query('SELECT * FROM activate_boost_checked($1)', [tx2]);

    await client.query(
      "UPDATE boosts SET starts_at = now() + interval '1 day', ends_at = now() + interval '2 days' WHERE id = $1",
      [boost2],
    );
    const scheduled = await charge(boost2, 'impression', 'visitor-future-1', 5);
    checkRow(scheduled, { counted: false, billed: false, exhausted: false }, 'programmée (début futur) : hors fenêtre, non facturée');

    await client.query(
      "UPDATE boosts SET starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' WHERE id = $1",
      [boost2],
    );
    const ended = await charge(boost2, 'impression', 'visitor-passe-1', 5);
    checkRow(ended, { counted: false, billed: false, exhausted: false }, 'terminée (fin passée) : hors fenêtre, non facturée');

    await client.query(
      "UPDATE boosts SET starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour', status = 'paused' WHERE id = $1",
      [boost2],
    );
    const paused = await charge(boost2, 'impression', 'visitor-paused-1', 5);
    checkRow(paused, { counted: false, billed: false }, 'pause admin : rien ne se facture');

    // ---------------------------------------------------------------
    console.log('5. Robustesse (id inconnu, campagne non-boost, unicité)');
    // ---------------------------------------------------------------
    const unknown = await charge('00000000-0000-0000-0000-000000000000', 'impression', 'visitor-inconnu1', 5);
    checkRow(unknown, { counted: false, billed: false, exhausted: false, remaining: null }, 'id inexistant : neutre');

    // activate_boost_checked sur une transaction premium (pas une boost) :
    // le claim doit être annulé par BOOST_NOT_FOUND, jamais laissé en l'air.
    const txPremium = await makeTransaction(999999993, 'premium');
    await client.query('SAVEPOINT sp_wrong_type');
    let wrongTypeError = null;
    try {
      await client.query('SELECT * FROM activate_boost_checked($1)', [txPremium]);
    } catch (error) {
      wrongTypeError = error;
    }
    check(wrongTypeError?.message?.includes('BOOST_NOT_FOUND'), 'transaction non-boost : BOOST_NOT_FOUND levé');
    if (wrongTypeError) await client.query('ROLLBACK TO SAVEPOINT sp_wrong_type');
    const claimRolledBack = await client.query(
      'SELECT activated_at FROM premium_transactions WHERE id = $1',
      [txPremium],
    );
    check(claimRolledBack.rows[0].activated_at === null, 'claim annulé avec l\'erreur (pas de transaction orpheline)');

    // Index partiel UNIQUE : impossible de doubler une campagne en cours.
    // (boost2 redevient active pour être dans le périmètre de l'index.)
    await client.query("UPDATE boosts SET status = 'active' WHERE id = $1", [boost2]);
    await client.query('SAVEPOINT sp_dup');
    let dupError = null;
    try {
      await client.query(
        `INSERT INTO boosts
           (market, room_id, gerant_id, mode, budget_total, starts_at, ends_at, status)
         VALUES ('CI', $1, $2, 'cpc', 1000, now(), now() + interval '7 days', 'active')`,
        [roomId, clerkUserId],
      );
    } catch (error) {
      dupError = error;
    }
    check(dupError?.code === '23505', '2e campagne active sur la même chambre refusée (unique partiel)');
    // Toujours revenir au savepoint : sans erreur, l'insertion a réussi (on
    // l'annule) ; avec erreur, la transaction doit être désavortée pour continuer.
    await client.query('ROLLBACK TO SAVEPOINT sp_dup');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end().catch(() => undefined);
  }

  console.log('');
  if (failures.length === 0) {
    console.log(`TOUS LES TESTS RPC PASSENT (${passed} assertions) — aucune donnée persistée (rollback).`);
  } else {
    console.error(`${failures.length} échec(s) sur ${passed + failures.length} assertions :`);
    for (const label of failures) console.error(`  - ${label}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('ERREUR :', error.message);
  process.exit(1);
});
