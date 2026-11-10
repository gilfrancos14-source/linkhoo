/**
 * Types pour pawaPay.
 *
 * Contrats alignés sur l'API v2 (checkouts, deposits, refunds, payouts).
 * Points importants :
 *   - les identifiants sont des UUID v4 de 36 caractères, générés par nos soins ;
 *   - `metadata` est un tableau d'objets à clé libre (10 max) ;
 *   - sur un checkout, `reason` est un objet localisé dont chaque valeur fait
 *     4 à 22 caractères `^[a-zA-Z0-9 ]+$` ;
 *   - les pays sont envoyés en ISO3 (CIV, BEN, SEN…) ;
 *   - `amount` est une chaîne décimale ;
 *   - les réponses utilisent `created` (et non `createdAt`).
 */

import type { MarketCode } from '../../config/markets';

/**
 * Devises supportées par pawaPay.
 */
export type PawapayCurrency =
  | 'XOF'
  | 'XAF'
  | 'GNF'
  | 'GHS'
  | 'NGN'
  | 'KES'
  | 'UGX'
  | 'RWF'
  | 'TZS'
  | 'USD';

/**
 * Environnement pawaPay.
 */
export type PawapayEnvironment = 'sandbox' | 'production';

/**
 * Configuration pawaPay résolue depuis l'environnement.
 */
export interface PawapayConfig {
  apiKey: string;
  baseUrl: string;
  merchantId: string;
  environment: PawapayEnvironment;
  /**
   * Vérifie les signatures RFC 9421 des callbacks. Toujours true en
   * production ; en dev, false par défaut (log-only) sauf
   * `PAWAPAY_VERIFY_CALLBACKS=true`.
   */
  verifyCallbacks: boolean;
  timeoutMs: number;
  checkoutTtlMinutes: number;
  /** false = mode observation : les webhooks sont ignorés. */
  applyEvents: boolean;
}

/**
 * Marché pawaPay.
 */
export interface PawapayMarket {
  country: string;
  currency: PawapayCurrency;
  minAmount: number;
  maxAmount: number;
  operators: string[];
}

/**
 * Statuts d'initiation (checkout, refund, payout).
 */
export type PawapayInitiationStatus = 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';

/**
 * Statut d'un checkout pawaPay (cycle de vie, distinct du statut d'initiation).
 */
export type PawapayCheckoutStatus =
  | 'WAITING_PAYMENT'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

/**
 * Statuts de dépôt (deposit) pawaPay.
 */
export type PawapayDepositStatus =
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'IN_RECONCILIATION'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Statuts de remboursement pawaPay.
 */
export type PawapayRefundStatus = 'ACCEPTED' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'DUPLICATE_IGNORED';

/**
 * Statuts de virement (payout) pawaPay.
 */
export type PawapayPayoutStatus = 'ACCEPTED' | 'ENQUEUED' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'DUPLICATE_IGNORED';

/**
 * Bénéficiaire pawaPay (mobile money uniquement).
 */
export interface PawapayRecipient {
  type: 'MMO';
  accountDetails: {
    phoneNumber: string;
    provider: string;
  };
}

/**
 * Montant pawaPay.
 */
export interface PawapayAmount {
  country: string; // ISO3
  currency: PawapayCurrency;
  amount: string;
}

/**
 * Métadonnées pawaPay : tableau d'objets à clé libre, 10 champs maximum.
 *
 * La documentation montre `[{ orderId: "…" }, { customerId: "…", isPII: true }]` :
 * chaque élément porte une ou plusieurs clés libres (pas de forme {name, value}).
 */
export type PawapayMetadataField = Record<string, string | boolean>;

/**
 * Paramètres de création d'un checkout pawaPay.
 */
export interface CreateCheckoutParams {
  checkoutId: string;
  returnUrl: string;
  /** Langue d'ouverture de la page hébergée (`en` ou `fr`). */
  defaultLanguage?: 'en' | 'fr';
  countries: string[]; // ISO3
  amounts: PawapayAmount[];
  expiresAfter: number; // minutes
  /** Raison localisée affichée au client : chaque valeur 4–22 car. `^[a-zA-Z0-9 ]+$`. */
  reason: Record<string, string>;
  clientReferenceId: string;
  metadata?: PawapayMetadataField[];
}

/**
 * Réponse de création d'un checkout pawaPay.
 */
export interface CreateCheckoutResponse {
  checkoutId: string;
  status: PawapayInitiationStatus;
  redirectUrl: string;
  checkoutCode: string;
  created: string;
  expiresAt: string;
  failureReason?: PawapayFailureReason;
}

/**
 * Raison d'échec d'une transaction chez pawaPay.
 */
export interface PawapayFailureReason {
  failureCode: string;
  failureMessage: string;
}

/**
 * Métadonnées en réponse : objet JSON clé → valeur.
 */
export type PawapayMetadataResponse = Record<string, string>;

/**
 * Tente de paiement (deposit) à l'intérieur d'un checkout.
 */
export interface CheckoutDeposit {
  depositId: string;
  status: 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created: string;
  providerTransactionId?: string;
  failureReason?: PawapayFailureReason;
  amount?: string;
  currency?: PawapayCurrency;
  country?: string;
  customerMessage?: string;
  metadata?: PawapayMetadataResponse;
}

/**
 * Corps du checkout retourné par GET /v2/checkouts/{id}.
 */
export interface CheckoutResource {
  checkoutId: string;
  status: PawapayCheckoutStatus;
  redirectUrl: string;
  checkoutCode: string;
  returnUrl?: string;
  countries: string[];
  amounts: PawapayAmount[];
  depositsHistory: CheckoutDeposit[];
  metadata: PawapayMetadataResponse;
  reason: Record<string, string>;
  clientReferenceId?: string;
  created: string;
  expiresAt?: string;
  providerTransactionId?: string;
  depositStatus?: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  /** Dernière tentative de paiement, quand disponible. */
  deposit?: CheckoutDeposit;
}

/**
 * Enveloppe de GET /v2/checkouts/{id}.
 */
export type CheckoutLookupResult =
  | { status: 'FOUND'; data: CheckoutResource }
  | { status: 'NOT_FOUND' };

/**
 * Ressource deposit (paiement) telle que renvoyée par GET /v2/deposits/{id}.
 */
export interface DepositResource {
  depositId: string;
  status: PawapayDepositStatus;
  amount: string;
  currency: PawapayCurrency;
  country: string;
  payer: PawapayRecipient;
  customerMessage?: string;
  clientReferenceId?: string;
  created: string;
  providerTransactionId?: string;
  failureReason?: PawapayFailureReason;
  metadata?: PawapayMetadataResponse;
}

/**
 * Enveloppe de GET /v2/deposits/{id}.
 */
export type DepositLookupResult =
  | { status: 'FOUND'; data: DepositResource }
  | { status: 'NOT_FOUND' };

/**
 * Ressource refund telle que renvoyée par GET /v2/refunds/{id}.
 */
export interface RefundResource {
  refundId: string;
  depositId: string;
  status: PawapayRefundStatus;
  amount: string;
  currency: PawapayCurrency;
  created: string;
  completed?: string;
  failureReason?: PawapayFailureReason;
  metadata?: PawapayMetadataResponse;
}

/**
 * Enveloppe de GET /v2/refunds/{id}.
 */
export type RefundLookupResult =
  | { status: 'FOUND'; data: RefundResource }
  | { status: 'NOT_FOUND' };

/**
 * Ressource payout telle que renvoyée par GET /v2/payouts/{id}.
 */
export interface PayoutResource {
  payoutId: string;
  status: PawapayPayoutStatus;
  amount: string;
  currency: PawapayCurrency;
  recipient: PawapayRecipient;
  created: string;
  completed?: string;
  failureReason?: PawapayFailureReason;
  metadata?: PawapayMetadataResponse;
}

/**
 * Enveloppe de GET /v2/payouts/{id}.
 */
export type PayoutLookupResult =
  | { status: 'FOUND'; data: PayoutResource }
  | { status: 'NOT_FOUND' };

/**
 * Paramètres de création d'un dépôt pawaPay (paiement déclenché côté serveur).
 */
export interface CreateDepositParams {
  depositId: string;
  checkoutId: string;
  amount: string;
  currency: PawapayCurrency;
  metadata?: PawapayMetadataField[];
}

/**
 * Réponse de création d'un dépôt pawaPay.
 */
export interface CreateDepositResponse {
  depositId: string;
  status: PawapayInitiationStatus;
  failureReason?: PawapayFailureReason;
}

/**
 * Paramètres de création d'un remboursement pawaPay.
 * Pas de champ `reason` : l'API le rejette (UNSUPPORTED_PARAMETER).
 */
export interface CreateRefundParams {
  refundId: string;
  depositId: string;
  amount: string; // string décimal
  /**
   * Obligatoire dès que `amount` est fourni (l'API rejette sinon avec
   * `MISSING_PARAMETER`). Doit correspondre à la devise du dépôt remboursé.
   */
  currency: PawapayCurrency;
}

/**
 * Réponse de création d'un remboursement pawaPay.
 */
export interface CreateRefundResponse {
  refundId: string;
  status: PawapayInitiationStatus;
  amount?: string;
  currency?: PawapayCurrency;
  created: string;
  failureReason?: PawapayFailureReason;
}

/**
 * Paramètres de création d'un virement pawaPay.
 */
export interface CreatePayoutParams {
  payoutId: string;
  amount: string; // string décimal
  currency: PawapayCurrency;
  recipient: PawapayRecipient;
  metadata?: PawapayMetadataField[];
}

/**
 * Réponse de création d'un virement pawaPay.
 */
export interface CreatePayoutResponse {
  payoutId: string;
  status: PawapayInitiationStatus;
  amount?: string;
  currency?: PawapayCurrency;
  created: string;
  failureReason?: PawapayFailureReason;
}

/**
 * Configuration active pawaPay (un opérateur / une devise / un type d'opération).
 */
export interface PawapayActiveConfig {
  operationType: 'DEPOSIT' | 'PAYOUT' | 'REFUND';
  country: string;
  minAmount: number;
  maxAmount: number;
  currency: PawapayCurrency;
}

/**
 * Réponse de GET /v2/active-conf.
 */
export interface PawapayActiveConfResult {
  companyName: string;
  countries: Array<{
    country: string;
    displayName: {
      en: string;
      fr: string;
    };
    prefix: string;
    flag: string;
    providers: Array<{
      provider: string;
      nameDisplayedToCustomer: string;
      displayName: string;
      logo: string;
      currencies: Array<{
        currency: string;
        displayName: string;
        operationTypes: {
          DEPOSIT: {
            minAmount: string;
            maxAmount: string;
            authType: string;
            pinPrompt: string;
            pinPromptRevivable: boolean;
            pinPromptInstructions?: {
              channels: Array<{
                type: string;
                displayName: {
                  en: string;
                  fr: string;
                };
              }>;
            };
          };
          PAYOUT?: {
            minAmount: string;
            maxAmount: string;
            authType: string;
            pinPrompt: string;
            pinPromptRevivable: boolean;
          };
          REFUND?: {
            minAmount: string;
            maxAmount: string;
            authType: string;
            pinPrompt: string;
            pinPromptRevivable: boolean;
          };
        };
      }>;
    }>;
  }>;
  signatureConfiguration: {
    signedRequestsOnly: boolean;
    signedCallbacks: boolean;
  };
}

/**
 * Clé publique renvoyée par `GET /v2/public-key/http`.
 */
export interface PawapayPublicKey {
  id: string;
  key: string;
}

/**
 * Erreur pawaPay.
 */
export interface PawapayError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Options de la requête HTTP.
 */
export interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Réponse HTTP interne.
 */
export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * En-têtes de signature des callbacks pawaPay (RFC 9421).
 */
export interface PawapaySignatureHeaders {
  'Signature-Input'?: string;
  'Signature'?: string;
  'Content-Digest'?: string;
  'Signature-Date'?: string;
}

/**
 * Type de marché réexporté pour commodité.
 */
export type { MarketCode };
