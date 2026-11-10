/**
 * Client HTTP pour l'API pawaPay.
 *
 * CORRECTIF : ajout d'un retry automatique (3 tentatives, backoff
 * exponentiel) sur les erreurs transitoires (5xx, timeout, erreur réseau).
 * Un fetch sans retry casse une transaction à la moindre micro-coupure.
 */

import { PawapayConfig } from './types';
import type {
  CreateCheckoutParams,
  CreateCheckoutResponse,
  CheckoutLookupResult,
  CreateDepositParams,
  CreateDepositResponse,
  DepositLookupResult,
  CreateRefundParams,
  CreateRefundResponse,
  RefundLookupResult,
  CreatePayoutParams,
  CreatePayoutResponse,
  PayoutLookupResult,
  PawapayActiveConfResult,
  PawapayPublicKey,
} from './types';
import { mapCountryToISO3 } from './mapping';

export class PawapayApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number = 0) {
    super(message);
    this.name = 'PawapayApiError';
    this.statusCode = statusCode;
  }
}

export class PawapayClient {
  private readonly config: PawapayConfig;

  constructor(config: PawapayConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    // pawaPay n'authentifie que par Bearer (cf. docs « Authentication »).
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.headers,
            ...options.headers,
          },
          signal: controller.signal,
        });

        // 5xx : retry sauf en dernière tentative
        if (response.status >= 500 && attempt < maxAttempts - 1) {
          clearTimeout(timeoutId);
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new PawapayApiError(`HTTP ${response.status}: ${errorText}`, response.status);
        }

        return (await response.json()) as T;
      } catch (error) {
        // Ne pas retry un PawapayApiError 4xx (définitif)
        if (error instanceof PawapayApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        const isAbort = error instanceof Error && error.name === 'AbortError';
        const isNetworkError = error instanceof Error && !(error instanceof PawapayApiError);

        if ((isAbort || isNetworkError) && attempt < maxAttempts - 1) {
          clearTimeout(timeoutId);
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
          continue;
        }

        if (isAbort) {
          throw new PawapayApiError('Requête pawaPay expirée (timeout)', 408);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new PawapayApiError('Requête pawaPay échouée après retries', 503);
  }

  async createCheckout(input: CreateCheckoutParams): Promise<CreateCheckoutResponse> {
    return this.request<CreateCheckoutResponse>('/v2/checkouts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getCheckoutStatus(checkoutId: string): Promise<CheckoutLookupResult> {
    return this.request<CheckoutLookupResult>(`/v2/checkouts/${checkoutId}`);
  }

  async createDeposit(input: CreateDepositParams): Promise<CreateDepositResponse> {
    return this.request<CreateDepositResponse>('/v2/deposits', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getDepositStatus(depositId: string): Promise<DepositLookupResult> {
    return this.request<DepositLookupResult>(`/v2/deposits/${depositId}`);
  }

  async createRefund(input: CreateRefundParams): Promise<CreateRefundResponse> {
    return this.request<CreateRefundResponse>('/v2/refunds', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getRefundStatus(refundId: string): Promise<RefundLookupResult> {
    return this.request<RefundLookupResult>(`/v2/refunds/${refundId}`);
  }

  async createPayout(input: CreatePayoutParams): Promise<CreatePayoutResponse> {
    return this.request<CreatePayoutResponse>('/v2/payouts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getPayoutStatus(payoutId: string): Promise<PayoutLookupResult> {
    return this.request<PayoutLookupResult>(`/v2/payouts/${payoutId}`);
  }

  async getActiveConf(
    country: string,
    operationType: 'DEPOSIT' | 'PAYOUT' | 'REFUND',
  ): Promise<PawapayActiveConfResult> {
    const iso3 = mapCountryToISO3(country);
    const params = new URLSearchParams({ country: iso3, operationType });
    return this.request<PawapayActiveConfResult>(`/v2/active-conf?${params}`);
  }

  /**
   * Clés publiques utilisées par pawaPay pour signer ses callbacks
   * (`GET /v2/public-key/http`). Nécessaire à la vérification RFC 9421.
   */
  async getPublicKeys(): Promise<PawapayPublicKey[]> {
    return this.request<PawapayPublicKey[]>('/v2/public-key/http');
  }
}