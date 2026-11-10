/**
 * Test de bout en bout de la création d'un checkout pawaPay en sandbox.
 *
 * On appelle la vraie fonction `createPawapayCheckout` (et non un
 * rejeu du payload) afin de valider la séquence réelle : conversion ISO3,
 * `reason` normalisé, metadata en tableau `{name, value}`, puis persistance
 * du checkoutId sur la ligne `payments`.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './src/config/supabase';
import { logger } from './src/lib/logger';
import { createPawapayCheckout } from './src/payments/pawapay/checkouts';
import { PawapayClient } from './src/payments/pawapay/client';
import { getPawapayConfig } from './src/payments/pawapay/config';

async function testPawapayCheckout() {
  // pawaPay refuse les URL localhost pour returnUrl. Pour valider la création
  // du checkout en sandbox (sans compléter la redirection), on force une URL
  // HTTPS publique syntactiquement valide.
  process.env.APP_PUBLIC_URL = 'https://example.com';

  const reference = `PAY-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const amountXof = 1000;

  // 1. Créer une ligne `payments` minimale pour que createPawapayCheckout
  //    puisse y mémoriser le checkoutId.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert({
      reference,
      purpose: 'booking',
      provider: 'pawapay',
      payer_type: 'client',
      market: 'CI',
      amount: amountXof,
      currency: 'XOF',
      amount_xof: amountXof,
      status: 'created',
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(
      `Impossible de créer la ligne payments de test : ${insertError?.message ?? 'id manquant'}`,
    );
  }

  logger.info('Ligne payments de test créée', { reference, paymentId: inserted.id });

  // 2. Appeler la vraie fonction de création de checkout.
  const session = await createPawapayCheckout({
    paymentId: inserted.id,
    reference,
    market: 'CI',
    amountXof,
    description: 'Test checkout pawaPay',
    returnPath: '/success',
    failurePath: '/failure',
  });

  logger.info('Checkout créé avec succès', session);

  if (!session.checkoutUrl) {
    throw new Error('redirectUrl manquant dans la réponse du checkout');
  }

  // 3. Vérifier que le checkoutId a bien été persisté sur la ligne payments.
  const { data: row } = await supabaseAdmin
    .from('payments')
    .select('pawapay_checkout_id, status')
    .eq('id', inserted.id)
    .single();

  logger.info('Ligne payments après création', row);

  if (!row?.pawapay_checkout_id) {
    throw new Error('pawapay_checkout_id non persisté sur la ligne payments');
  }

  // 4. Re-lire le statut du checkout via l'API (enveloppe FOUND/NOT_FOUND).
  const client = new PawapayClient(getPawapayConfig());
  const lookup = await client.getCheckoutStatus(session.checkoutId);
  logger.info('Statut du checkout', lookup);

  if (lookup.status !== 'FOUND') {
    throw new Error('Le checkout créé est introuvable via GET /v2/checkouts/{id}');
  }

  console.log('\n✅ Checkout sandbox valide :');
  console.log('   redirectUrl :', session.checkoutUrl);
  console.log('   checkoutId  :', session.checkoutId);
  console.log('   reference   :', session.reference);
  console.log('   statut      :', lookup.data.status);
}

// Exécuter le test
testPawapayCheckout()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test échoué:', error);
    process.exit(1);
  });
