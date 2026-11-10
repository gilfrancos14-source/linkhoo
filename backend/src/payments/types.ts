/**
 * Types du domaine paiement.
 *
 * Ils sont volontairement indépendants du prestataire : les routes et les
 * services manipulent ces valeurs, la couche `pawapay/` traduit vers et depuis
 * l'API. Un changement de prestataire ne doit pas se propager au reste du
 * backend.
 */

import type { PawapayCurrency } from './pawapay/types';

export type { PawapayCurrency };

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

export type PayerType = 'gerant' | 'client';

/** Session de checkout renvoyée au front (aucune clé n'y figure). */
export interface CheckoutSession {
  readonly reference: string;
  readonly checkoutUrl: string;
  /** URL de redirection pawaPay (le front utilise l'une ou l'autre). */
  readonly redirectUrl?: string;
  /** Identifiant de checkout pawaPay, utile au suivi côté client. */
  readonly checkoutId?: string;
  readonly amount: number;
  /** Devise réellement débitée. */
  readonly currency: PawapayCurrency;
  readonly amountXof: number;
  readonly fxRate: number;
  readonly expiresAt: string;
}
