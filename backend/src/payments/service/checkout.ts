/**
 * Création d'une session de paiement Hub2.
 *
 * Séquence :
 *   1. générer une `reference` (`PAY-…`) unique — clé d'idempotence de bout
 *      en bout, envoyée comme `purchaseReference` ;
 *   2. convertir le prix de référence (XOF) vers la devise débitée ;
 *   3. écrire la ligne `payments` en `created` AVANT d'appeler Hub2 : si le
 *      processus meurt après la création du lien, la trace existe et la
 *      réconciliation peut retrouver le paiement par sa référence ;
 *   4. créer le Payment Link puis enregistrer `checkout_url` et passer en
 *      `pending`.
 *
 * Le montant n'est JAMAIS lu du corps de la requête : l'appelant fournit un
 * `amountXof` serveur (constante produit ou calcul depuis la chambre).
 */

import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import { HUB2_MARKETS, getHub2Config, isMarketSupported } from '../config';
import { PaymentServiceError } from '../errors';
import { createPaymentLink } from '../hub2/paymentLinks';
import { Hub2Error } from '../hub2/client';
import type {
  CheckoutSession,
  Hub2Currency,
  PayerType,
  PaymentPurpose,
} from '../types';

export interface CreateCheckoutInput {
  readonly purpose: PaymentPurpose;
  readonly market: MarketCode;
  readonly amountXof: number;
  readonly payerType: PayerType;
  readonly payerClerkUserId?: string | null;
  readonly gerantClerkUserId?: string | null;
  readonly clientId?: string | null;
  readonly reservationId?: string | null;
  readonly boostId?: string | null;
  readonly description: string;
  /** Chemin public du retour succès, ex. `/ci/gerant/premium/success`. */
  readonly returnPath: string;
  /** Chemin public du retour échec (défaut : le retour succès). */
  readonly failurePath?: string;
  readonly metadata?: Record<string, unknown>;
  /**
   * Réutilise un checkout encore valide pour le même payeur/produit. Évite
   * deux liens (et deux débits possibles) sur un double-clic.
   */
  readonly reusePendingPayment?: boolean;
}

/** `PAY-2026-A1B2C3D4E5F6` — compatible avec le CHECK de `payments.reference`. */
export function buildPaymentReference(now: Date = new Date()): string {
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  return `PAY-${now.getUTCFullYear()}-${suffix}`;
}

function publicBaseUrl(): string {
  return (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Construit une URL absolue à partir d'un chemin interne.
 *
 * Le chemin vient du serveur, jamais d'un en-tête `Origin` : une redirection
 * post-paiement vers un domaine tiers serait du phishing.
 */
export function buildPublicUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new PaymentServiceError(
      'PAYMENT_CREATE_FAILED',
      `Chemin de retour invalide : ${path}`,
      500,
    );
  }
  return `${publicBaseUrl()}${path}`;
}

function appendReference(path: string, reference: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}reference=${encodeURIComponent(reference)}`;
}

/**
 * Taux XOF → devise de débit. XAF est à parité fixe (1), GNF flotte.
 * Sans taux du jour, on refuse plutôt que d'inventer un montant.
 */
export async function resolveFxRate(currency: Hub2Currency): Promise<number> {
  if (currency === 'XOF') return 1;

  const { data, error } = await supabaseAdmin
    .from('fx_rates')
    .select('rate')
    .eq('base_currency', 'XOF')
    .eq('quote_currency', currency)
    .lte('effective_at', new Date().toISOString())
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const rate = Number((data as { rate?: unknown } | null)?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new PaymentServiceError(
      'FX_RATE_MISSING',
      `Aucun taux XOF→${currency} disponible : paiement refusé.`,
      422,
      { currency },
    );
  }
  return rate;
}

interface PendingPaymentRow {
  reference: string;
  checkout_url: string | null;
  amount: number;
  currency: Hub2Currency;
  amount_xof: number;
  fx_rate: number | string;
  expires_at: string | null;
}

async function findReusablePayment(
  input: CreateCheckoutInput,
): Promise<CheckoutSession | null> {
  if (!input.reusePendingPayment) return null;
  if (!input.reservationId && !input.gerantClerkUserId) return null;

  let query = supabaseAdmin
    .from('payments')
    .select('reference, checkout_url, amount, currency, amount_xof, fx_rate, expires_at')
    .eq('purpose', input.purpose)
    .in('status', ['created', 'pending', 'requires_action'])
    .gt('expires_at', new Date().toISOString());

  // Une réservation n'a qu'un seul checkout vivant : la clé est l'id de
  // réservation, pas le gérant (qui peut avoir plusieurs réservations en
  // parallèle).
  query = input.reservationId
    ? query.eq('reservation_id', input.reservationId)
    : query.eq('gerant_clerk_user_id', input.gerantClerkUserId as string);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const row = data as PendingPaymentRow | null;
  if (!row?.checkout_url) return null;

  return {
    reference: row.reference,
    checkoutUrl: row.checkout_url,
    amount: Number(row.amount),
    currency: row.currency,
    amountXof: Number(row.amount_xof),
    fxRate: Number(row.fx_rate),
    expiresAt: row.expires_at ?? '',
  };
}

/**
 * Crée la ligne `payments`, le Payment Link Hub2, puis renvoie la session.
 *
 * @throws PaymentServiceError (marché fermé, taux absent, écriture impossible)
 * @throws Hub2Error (refus Hub2 : opérateur, montant, authentification)
 * @throws Hub2ConfigError (clés absentes)
 */
export async function createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
  if (!Number.isInteger(input.amountXof) || input.amountXof <= 0) {
    throw new PaymentServiceError('PAYMENT_CREATE_FAILED', 'Montant XOF invalide.', 400);
  }
  if (!isMarketSupported(input.market)) {
    throw new PaymentServiceError(
      'ONLINE_PAYMENT_DISABLED',
      `Le paiement en ligne n'est pas disponible sur le marché ${input.market}.`,
      422,
      { market: input.market },
    );
  }

  const reusable = await findReusablePayment(input);
  if (reusable) return reusable;

  const config = getHub2Config();
  const market = HUB2_MARKETS[input.market];
  const fxRate = await resolveFxRate(market.currency);
  // Les devises Hub2 sont sans décimale : arrondi au franc supérieur/inférieur
  // le plus proche, jamais de centimes inventés.
  const amount = Math.round(input.amountXof * fxRate);
  const reference = buildPaymentReference();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.paymentLinkTtlMinutes * 60_000);

  const successUrl = buildPublicUrl(appendReference(input.returnPath, reference));
  const failureUrl = buildPublicUrl(
    appendReference(input.failurePath ?? input.returnPath, reference),
  );

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert({
      reference,
      purpose: input.purpose,
      provider: 'hub2',
      payer_type: input.payerType,
      payer_clerk_user_id: input.payerClerkUserId ?? null,
      gerant_clerk_user_id: input.gerantClerkUserId ?? null,
      client_id: input.clientId ?? null,
      reservation_id: input.reservationId ?? null,
      boost_id: input.boostId ?? null,
      market: input.market,
      amount,
      currency: market.currency,
      amount_xof: input.amountXof,
      fx_rate: fxRate,
      status: 'created',
      expires_at: expiresAt.toISOString(),
      metadata: {
        ...input.metadata,
        return_path: input.returnPath,
        failure_path: input.failurePath ?? input.returnPath,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    throw new PaymentServiceError(
      'PAYMENT_CREATE_FAILED',
      `Impossible d'enregistrer le paiement : ${insertError.message}`,
      500,
    );
  }

  const paymentId = (inserted as { id?: string } | null)?.id;
  if (!paymentId) {
    throw new PaymentServiceError('PAYMENT_CREATE_FAILED', 'Paiement non enregistré.', 500);
  }

  let link;
  try {
    link = await createPaymentLink(config, {
      reference,
      amount,
      currency: market.currency,
      market: input.market,
      description: input.description,
      successUrl,
      failureUrl,
      expiresAt,
    });
  } catch (error) {
    const code = error instanceof Hub2Error ? error.code : 'HUB2_ERROR';
    const message = error instanceof Error ? error.message : 'Création du lien impossible';
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        failure_code: code,
        failure_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);
    throw error;
  }

  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      provider_payment_link_id: link.id,
      checkout_url: link.url,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    throw new PaymentServiceError(
      'PAYMENT_UPDATE_FAILED',
      `Lien créé mais non enregistré : ${updateError.message}`,
      500,
      { reference },
    );
  }

  return {
    reference,
    checkoutUrl: link.url,
    amount,
    currency: market.currency,
    amountXof: input.amountXof,
    fxRate,
    expiresAt: expiresAt.toISOString(),
  };
}
