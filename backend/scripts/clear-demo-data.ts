#!/usr/bin/env tsx
/**
 * Vide les DONNÉES DE DÉMO de la base locale, sans toucher :
 *   - aux données de référence (pawapay_markets, payment_policies, fx_rates,
 *     escapades) nécessaires au paiement/commission ;
 *   - à l'historique des migrations (schema_migrations).
 *
 * Idempotent : peut être relancé sans risque.
 *
 * Usage : npm run db:clear-demo   (ou npx tsx scripts/clear-demo-data.ts)
 */

import 'dotenv/config';
import { Client } from 'pg';

const DEMO_TABLES = [
  // Dépendances d'abord (FK) pour éviter les violations.
  'reservations',
  'reviews',
  'client_favorites',
  'client_notifications',
  'notifications',
  'messages',
  'conversations',
  'contact_messages',
  'newsletter_subscribers',
  'payments',
  'payment_refunds',
  'payment_payouts',
  'payment_events',
  'pawapay_webhooks',
  'premium_transactions',
  'boosts',
  'boost_dedup',
  'banners',
  'admin_audit_log',
  'verification_documents',
  // Contenu de démo
  'rooms',
  'categories',
  'events',
  'tourism_destinations',
  // Comptes de test
  'clients',
  'admins',
  'gerants',
];

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  try {
    console.log('Nettoyage des données de démo…');
    // TRUNCATE ... CASCADE gère les FK entre tables ; on inclut toutes les
    // tables concernées dans une seule commande pour rester atomique.
    const list = DEMO_TABLES.join(', ');
    await c.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    console.log(`[OK] ${DEMO_TABLES.length} tables vidées.`);

    // Contrôle : afficher ce qui reste.
    const remaining = await c.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `);
    console.log('\nÉtat après nettoyage :');
    for (const t of remaining.rows) {
      const name = (t as any).table_name;
      const r = await c.query(`SELECT count(*)::int AS n FROM public."${name}"`);
      const n = (r.rows[0] as any).n;
      console.log(`  ${name.padEnd(35)} ${n}`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error('[ERREUR]', e.message); process.exit(1); });
