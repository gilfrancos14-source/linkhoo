/**
 * Erreurs du domaine paiement.
 *
 * Elles portent un `code` stable (utilisable par le front et les logs) et un
 * `status` HTTP par défaut. Les routes traduisent, les services ne connaissent
 * pas Express.
 */

export type PaymentErrorCode =
  | 'FX_RATE_MISSING'
  | 'MARKET_NOT_SUPPORTED'
  | 'ONLINE_PAYMENT_DISABLED'
  | 'PAYMENT_CREATE_FAILED'
  | 'PAYMENT_UPDATE_FAILED'
  | 'PAYMENT_FETCH_FAILED'
  | 'PAYMENT_PROVIDER_NOT_SUPPORTED'
  | 'REFUND_UPDATE_FAILED'
  | 'REFUND_FETCH_FAILED'
  | 'REFUND_NOT_FOUND'
  | 'REFUND_ALREADY_SUCCEEDED'
  | 'REFUND_IN_FLIGHT'
  | 'REFUND_MANUAL_REQUIRED'
  | 'PAYOUT_UPDATE_FAILED'
  | 'PAYOUT_FETCH_FAILED'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_FORBIDDEN'
  | 'PAYMENT_NOT_PREMIUM'
  | 'PAYMENT_NOT_BOOKING'
  | 'PAYMENT_NOT_SUCCEEDED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'PAYMENT_NOT_REFUNDABLE'
  | 'PAYMENT_REFUND_FAILED'
  | 'PAYMENT_NOT_PAYABLE'
  | 'GERANT_NOT_FOUND'
  | 'PAYOUT_DETAILS_INCOMPLETE'
  | 'PAYOUT_NOT_FOUND'
  | 'PAYOUT_NOTHING_TO_WITHDRAW'
  | 'PAYOUT_AMOUNT_INVALID'
  | 'PAYOUT_WITHDRAWAL_PENDING';

export class PaymentServiceError extends Error {
  readonly code: PaymentErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: PaymentErrorCode,
    message: string,
    status = 400,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PaymentServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
