/**
 * Types du domaine paiement.
 *
 * Ils sont volontairement indépendants de Hub2 : les routes et les services
 * manipulent ces valeurs, la couche `hub2/` traduit vers et depuis l'API.
 * Un changement de prestataire ne doit pas se propager au reste du backend.
 */

import type { MarketCode } from '../config/markets';

export type PaymentPurpose = 'premium' | 'boost' | 'verification' | 'booking';

/**
 * Cycle de vie d'un encaissement.
 *
 * `requires_action` couvre l'attente de validation USSD côté opérateur :
 * le paiement n'est ni réussi ni échoué, et le webhook tranchera.
 */
export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'expired';

export type RefundStatus =
  | 'requested'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'manual_required'
  | 'canceled';

export type TransferStatus = 'scheduled' | 'processing' | 'paid' | 'failed' | 'canceled';

/** Moyen de reversement déclaré par le gérant. */
export type PayoutMethod = 'mobile_money' | 'bank_transfer';

export interface MobileMoneyDestination {
  readonly type: 'mobile_money';
  readonly country: string;
  readonly msisdn: string;
  readonly provider: string;
  readonly recipientName?: string;
}

export interface BankTransferDestination {
  readonly type: 'bank_transfer';
  readonly country: string;
  readonly accountNumber: string;
  readonly accountOwner: string;
  readonly bankCode: string;
  readonly bankName: string;
  readonly beneficiaryPhone: string;
  readonly recipientName?: string;
}

export type TransferDestination = MobileMoneyDestination | BankTransferDestination;

export type PayerType = 'gerant' | 'client';

/** Devise réellement débitée par Hub2 sur un marché. */
export type Hub2Currency = 'XOF' | 'XAF' | 'GNF';

export type Hub2Environment = 'sandbox' | 'live';

export interface Hub2Config {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly merchantId: string;
  readonly environment: Hub2Environment;
  /** `null` quand le secret n'est pas configuré : le webhook répond 503. */
  readonly webhookSecret: string | null;
  readonly timeoutMs: number;
  readonly paymentLinkTtlMinutes: number;
  /** Mode observation : les événements sont stockés mais rien n'est activé. */
  readonly applyEvents: boolean;
}

export interface PaymentLinkInput {
  /** `purchaseReference` Hub2 : identifiant interne unique (`PAY-…`). */
  readonly reference: string;
  readonly amount: number;
  readonly currency: Hub2Currency;
  readonly market: MarketCode;
  readonly description: string;
  readonly successUrl: string;
  readonly failureUrl: string;
  readonly expiresAt: Date;
  /** Verrouille le lien sur un numéro : seul ce numéro peut payer. */
  readonly customerPhoneNumber?: string;
}

export interface PaymentLinkResult {
  readonly id: string;
  readonly url: string;
  readonly status: string;
  readonly expiresAt: string;
}

/** Session de checkout renvoyée au front (aucune clé n'y figure). */
export interface CheckoutSession {
  readonly reference: string;
  readonly checkoutUrl: string;
  readonly amount: number;
  readonly currency: Hub2Currency;
  readonly amountXof: number;
  readonly fxRate: number;
  readonly expiresAt: string;
}
