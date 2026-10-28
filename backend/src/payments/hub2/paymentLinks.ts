/**
 * Création d'un Payment Link Hub2 (checkout hébergé).
 *
 * Choix : Payment Link plutôt que PaymentIntent. Le parcours actuel redirige
 * déjà le payeur vers une page hébergée (FedaPay) ; le lien conserve ce
 * fonctionnement, ne demande aucun composant de carte côté front, et
 * `purchaseReference` sert de clé de corrélation de bout en bout.
 *
 * Le corps envoyé est construit ici, jamais par l'appelant : le montant, la
 * devise et la liste des opérateurs viennent de la configuration serveur.
 */

import { HUB2_MARKETS, MIN_AMOUNT_BY_CURRENCY, isMarketSupported } from '../config';
import type { Hub2Config, PaymentLinkInput, PaymentLinkResult } from '../types';
import { Hub2Error, hub2Request } from './client';

const REFERENCE_PATTERN = /^PAY-[A-Z0-9-]{6,40}$/;

export interface Hub2PaymentLinkBody {
  readonly purchaseReference: string;
  readonly amount: number;
  readonly currency: string;
  readonly country: string;
  readonly paymentMethods: readonly string[];
  readonly providers: readonly string[];
  readonly type: 'single_use';
  readonly expirationDate: string;
  readonly successUrl: string;
  readonly failureUrl: string;
  readonly description: string;
  readonly customerPhoneNumber?: string;
}

function assertHttpsUrl(value: string, field: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Hub2Error(`${field} n’est pas une URL valide.`, { code: 'PAYMENT_LINK_INVALID_URL' });
  }
  const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !isLocalDev) {
    throw new Hub2Error(`${field} doit utiliser https.`, { code: 'PAYMENT_LINK_INSECURE_URL' });
  }
}

function assertAmount(amount: number, currency: PaymentLinkInput['currency']): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Hub2Error('Le montant doit être un entier positif.', {
      code: 'PAYMENT_LINK_INVALID_AMOUNT',
    });
  }
  const minimum = MIN_AMOUNT_BY_CURRENCY[currency];
  if (amount < minimum) {
    throw new Hub2Error(`Le montant minimum Hub2 en ${currency} est ${minimum}.`, {
      code: 'PAYMENT_LINK_AMOUNT_TOO_LOW',
    });
  }
}

/**
 * Construit le corps `POST /payment-links` et vérifie les invariants locaux.
 * Exporté pour que les tests couvrent le contrat sans appeler Hub2.
 */
export function buildPaymentLinkBody(input: PaymentLinkInput): Hub2PaymentLinkBody {
  if (!REFERENCE_PATTERN.test(input.reference)) {
    throw new Hub2Error(`Référence invalide : ${input.reference}`, {
      code: 'PAYMENT_LINK_INVALID_REFERENCE',
    });
  }
  if (!isMarketSupported(input.market)) {
    throw new Hub2Error(`Paiement en ligne indisponible sur le marché ${input.market}.`, {
      code: 'MARKET_NOT_SUPPORTED',
    });
  }

  const market = HUB2_MARKETS[input.market];
  if (market.currency !== input.currency) {
    throw new Hub2Error(
      `Devise ${input.currency} incohérente avec le marché ${input.market} (${market.currency}).`,
      { code: 'PAYMENT_LINK_CURRENCY_MISMATCH' },
    );
  }

  assertAmount(input.amount, input.currency);
  assertHttpsUrl(input.successUrl, 'successUrl');
  assertHttpsUrl(input.failureUrl, 'failureUrl');

  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
    throw new Hub2Error('expiresAt doit être une date valide.', {
      code: 'PAYMENT_LINK_INVALID_EXPIRY',
    });
  }
  if (input.expiresAt.getTime() <= Date.now()) {
    throw new Hub2Error('expiresAt doit être dans le futur.', {
      code: 'PAYMENT_LINK_INVALID_EXPIRY',
    });
  }

  return {
    purchaseReference: input.reference,
    amount: input.amount,
    currency: input.currency,
    country: input.market,
    paymentMethods: market.methods,
    providers: market.providers,
    type: 'single_use',
    expirationDate: input.expiresAt.toISOString(),
    successUrl: input.successUrl,
    failureUrl: input.failureUrl,
    description: input.description,
    ...(input.customerPhoneNumber ? { customerPhoneNumber: input.customerPhoneNumber } : {}),
  };
}

/**
 * Crée le lien et renvoie uniquement les champs utiles au backend.
 *
 * Aucun rejeu automatique : un second POST créerait un second lien pour la
 * même `purchaseReference`. En cas de timeout, l'appelant conserve la ligne
 * `payments` en `created` et la réconciliation tranche.
 */
export async function createPaymentLink(
  config: Hub2Config,
  input: PaymentLinkInput,
): Promise<PaymentLinkResult> {
  const body = buildPaymentLinkBody(input);
  const response = await hub2Request<Record<string, unknown>>(config, '/payment-links', {
    method: 'POST',
    body,
  });

  const id = typeof response.id === 'string' ? response.id : '';
  const url = typeof response.url === 'string' ? response.url : '';
  if (!id || !url) {
    throw new Hub2Error('Réponse Hub2 incomplète pour le Payment Link.', {
      code: 'HUB2_INVALID_RESPONSE',
      details: { hasId: Boolean(id), hasUrl: Boolean(url) },
    });
  }

  return {
    id,
    url,
    status: typeof response.status === 'string' ? response.status : 'active',
    expiresAt:
      typeof response.expirationDate === 'string'
        ? response.expirationDate
        : body.expirationDate,
  };
}
