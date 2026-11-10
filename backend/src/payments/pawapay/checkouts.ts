/**
 * Création d'un checkout pawaPay.
 */

import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import {
  getPawapayConfig,
  getMarketPaymentConfig,
  isMarketSupported,
  PawapayConfigError,
} from './config';
import { PawapayClient } from './client';
import { logger } from '../../lib/logger';
import type { PawapayCurrency, PawapayMetadataField } from './types';
import { mapCountryToISO3 } from './mapping';
import { paymentReturnBaseUrl, isHttpsUrl } from '../returnUrl';
import { validateAmountForMarket } from './markets';
import { assertDepositAmountAllowed } from './activeConf';
import { createCheckoutId } from './utils';

export interface PawapayCheckoutInput {
  paymentId: string;
  reference: string;
  market: MarketCode;
  amountXof: number;
  description: string;
  returnPath: string;
  failurePath: string;
  metadata?: Record<string, unknown>;
}

export interface PawapayCheckoutResult {
  reference: string;
  checkoutUrl: string;
  redirectUrl: string;
  checkoutId: string;
  amount: number;
  currency: PawapayCurrency;
  amountXof: number;
  fxRate: number;
  expiresAt: string;
}

export function normalizePawapayReason(text: string): string {
  const ascii = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (ascii.length >= 4) return ascii.slice(0, 22);
  return 'Paiement Ileyha';
}

export function buildMetadata(input: PawapayCheckoutInput): PawapayMetadataField[] {
  const fields: Array<[string, unknown]> = [
    ['paymentId', input.paymentId],
    ['returnPath', input.returnPath],
    ['failurePath', input.failurePath],
    ...(input.metadata ? Object.entries(input.metadata) : []),
  ];

  const seen = new Set<string>();
  const result: PawapayMetadataField[] = [];

  for (const [name, value] of fields) {
    if (result.length >= 10) break;
    const key = name.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ [key]: String(value ?? '').slice(0, 200) });
  }

  return result;
}

export async function resolveFxRate(market: MarketCode, currency: PawapayCurrency): Promise<number> {
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

  if (error || !data) {
    throw new PawapayConfigError(
      'FX_RATE_MISSING',
      `Aucun taux XOF→${currency} disponible pour le marché ${market}.`,
    );
  }

  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new PawapayConfigError(
      'FX_RATE_MISSING',
      `Taux XOF→${currency} invalide pour le marché ${market}.`,
    );
  }
  return rate;
}

export async function createPawapayCheckout(
  input: PawapayCheckoutInput,
): Promise<PawapayCheckoutResult> {
  const config = getPawapayConfig();
  const marketConfig = getMarketPaymentConfig(input.market);

  if (!isMarketSupported(input.market)) {
    throw new PawapayConfigError(
      'MARKET_NOT_SUPPORTED',
      `Le marché ${input.market} n'est pas supporté par pawaPay.`,
    );
  }

  const checkoutId = createCheckoutId();
  const fxRate = await resolveFxRate(input.market, marketConfig.currency);
  const amount = Math.round(input.amountXof * fxRate);

  // Bornes statiques par devise (le plafond global XOF est déjà contrôlé par
  // `service/checkout.ts`). Les bornes réelles par opérateur sont vérifiées
  // juste après via `/v2/active-conf`.
  try {
    validateAmountForMarket(input.market, amount);
  } catch (error) {
    throw new PawapayConfigError(
      'AMOUNT_OUT_OF_RANGE',
      error instanceof Error ? error.message : `Montant hors limites pour ${input.market}.`,
    );
  }

  const publicBaseUrl = paymentReturnBaseUrl();
  if (!isHttpsUrl(publicBaseUrl, process.env)) {
    const isDev = process.env.NODE_ENV === 'development';
    const isLocalhost = /localhost(:\d+)?$/.test(publicBaseUrl);
    
    if (!isDev || !isLocalhost) {
      throw new PawapayConfigError(
        'RETURN_URL_NOT_HTTPS',
        "pawaPay exige une URL de retour HTTPS publique. En local, exposez le front via un tunnel et renseignez PAYMENTS_RETURN_BASE_URL.",
      );
    }
  }
  const returnUrl = `${publicBaseUrl}${input.returnPath}?reference=${encodeURIComponent(input.reference)}`;
  const countryIso3 = mapCountryToISO3(input.market);
  const client = new PawapayClient(config);
  const reasonText = normalizePawapayReason(input.description);

  // Validation dynamique : si active-conf est indisponible (réseau/5xx), on
  // n'empêche pas une vente — pawaPay rejettera de toute façon un montant
  // invalide, mais un incident sur ce endpoint ne doit pas bloquer le checkout.
  try {
    await assertDepositAmountAllowed(client, countryIso3, marketConfig.currency, amount);
  } catch (error) {
    if (error instanceof PawapayConfigError) throw error;
    logger.warn('Validation active-conf pawaPay indisponible, bornes statiques conservées', {
      error: error instanceof Error ? error.message : String(error),
      market: input.market,
      amount,
    });
  }

  // pawaPay exige que `checkoutId` soit généré ET persisté AVANT l'appel :
  // un callback peut arriver avant la réponse HTTP, et un crash ne doit pas
  // laisser un checkout vivant sans identifiant en base.
  const provisionalExpiresAt = new Date(
    Date.now() + config.checkoutTtlMinutes * 60_000,
  ).toISOString();

  const { error: reserveError } = await supabaseAdmin
    .from('payments')
    .update({
      pawapay_checkout_id: checkoutId,
      amount,
      currency: marketConfig.currency,
      amount_xof: input.amountXof,
      fx_rate: fxRate,
      expires_at: provisionalExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.paymentId);

  if (reserveError) {
    throw new PawapayConfigError(
      'CHECKOUT_PERSIST_FAILED',
      `Impossible de réserver le checkout pawaPay avant l'appel : ${reserveError.message}`,
    );
  }

  let checkoutResponse;
  try {
    checkoutResponse = await client.createCheckout({
      checkoutId,
      returnUrl,
      defaultLanguage: 'fr',
      countries: [countryIso3],
      amounts: [
        {
          country: countryIso3,
          currency: marketConfig.currency,
          amount: amount.toFixed(0),
        },
      ],
      expiresAfter: config.checkoutTtlMinutes,
      reason: { fr: reasonText, en: reasonText },
      clientReferenceId: input.reference,
      metadata: buildMetadata(input),
    });
  } catch (error) {
    logger.error('Erreur lors de la création du checkout pawaPay', {
      error,
      checkoutId,
      reference: input.reference,
    });
    throw error;
  }

  // CORRECTIF : gérer DUPLICATE_IGNORED (checkoutId déjà connu) en relisant
  // l'état courant, plutôt que de crasher sur redirectUrl vide.
  if (checkoutResponse.status === 'DUPLICATE_IGNORED') {
    const existing = await client.getCheckoutStatus(checkoutId);
    if (existing.status === 'FOUND' && existing.data.redirectUrl) {
      logger.info('Checkout pawaPay déjà existant, réutilisation', {
        checkoutId,
        reference: input.reference,
      });
      const existingExpires =
        existing.data.expiresAt
        ?? new Date(Date.now() + config.checkoutTtlMinutes * 60_000).toISOString();

      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          checkout_url: existing.data.redirectUrl,
          expires_at: existingExpires,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.paymentId);
      if (updateError) {
        logger.warn('Impossible de mémoriser le checkout pawaPay (duplicate)', {
          checkoutId,
          error: updateError,
        });
      }

      return {
        reference: input.reference,
        checkoutUrl: existing.data.redirectUrl,
        redirectUrl: existing.data.redirectUrl,
        checkoutId,
        amount,
        currency: marketConfig.currency,
        amountXof: input.amountXof,
        fxRate,
        expiresAt: existingExpires,
      };
    }
    throw new PawapayConfigError(
      'PAWAPAY_INVALID_ENV',
      'pawaPay a retourné DUPLICATE_IGNORED mais le checkout est introuvable.',
    );
  }

  // CORRECTIF : code d'erreur générique — un REJECTED peut être un montant
  // hors limites, un opérateur invalide, etc. Pas forcément MARKET_NOT_SUPPORTED.
  if (checkoutResponse.status === 'REJECTED') {
    const failure = checkoutResponse.failureReason;
    const reason = failure
      ? `${failure.failureCode} — ${failure.failureMessage}`
      : 'raison inconnue';
    logger.warn('Checkout pawaPay refusé à la création', {
      checkoutId,
      reference: input.reference,
      failureReason: failure,
    });
    throw new PawapayConfigError(
      'PAWAPAY_INVALID_ENV',
      `pawaPay a refusé le checkout : ${reason}`,
    );
  }

  const expiresAt = checkoutResponse.expiresAt ?? provisionalExpiresAt;

  // Le checkout est déjà réservé en base : un échec de cet UPDATE ne doit pas
  // faire marquer le paiement `failed` (le checkout est vivant et payable).
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      checkout_url: checkoutResponse.redirectUrl,
      expires_at: expiresAt,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.paymentId);

  if (updateError) {
    logger.warn('Impossible de finaliser le checkout pawaPay en base', {
      checkoutId,
      paymentId: input.paymentId,
      error: updateError,
    });
  }

  logger.info('Checkout pawaPay créé', {
    checkoutId,
    reference: input.reference,
    amount,
    currency: marketConfig.currency,
  });

  return {
    reference: input.reference,
    checkoutUrl: checkoutResponse.redirectUrl,
    redirectUrl: checkoutResponse.redirectUrl,
    checkoutId,
    amount,
    currency: marketConfig.currency,
    amountXof: input.amountXof,
    fxRate,
    expiresAt,
  };
}