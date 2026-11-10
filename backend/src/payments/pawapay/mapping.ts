/**
 * Mapping des données entre notre système et pawaPay.
 *
 * CORRECTIF : `mapPawapayStatus` reconnaît `SUCCEEDED` (alias utilisé par
 * webhooks.ts) et documente l'incohérence `'completed'` vs `'succeeded'`.
 */

import { logger } from '../../lib/logger';

export function mapPawapayPaymentType(type: string): string {
  switch (type.toLowerCase()) {
    case 'premium':
      return 'premium';
    case 'reservation':
      return 'reservation';
    case 'refund':
      return 'refund';
    case 'payout':
      return 'payout';
    default:
      logger.warn('Type de paiement pawaPay non reconnu', { type });
      return 'unknown';
  }
}

/**
 * Mappe un statut pawaPay vers notre statut interne (`PaymentStatus`).
 *
 * `payments.status` n'autorise que `created, pending, requires_action,
 * succeeded, failed, canceled, expired` : la fonction ne produit donc JAMAIS
 * `completed` ni `cancelled` (2 L). Les statuts d'initiation d'une opération
 * encore en vol (`ACCEPTED`, `ENQUEUED`, `DUPLICATE_IGNORED`) sont ramenés à
 * `pending`.
 */
export function mapPawapayStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'WAITING_PAYMENT':
    case 'PROCESSING':
    case 'PENDING':
    case 'ACCEPTED':
    case 'ENQUEUED':
    case 'DUPLICATE_IGNORED':
      return 'pending';
    case 'COMPLETED':
    case 'SUCCEEDED':
      return 'succeeded';
    case 'FAILED':
    case 'REJECTED':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    case 'CANCELLED':
      return 'canceled';
    default:
      logger.warn('Statut pawaPay non reconnu', { status });
      return 'unknown';
  }
}

export function mapToPawapayStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'WAITING_PAYMENT';
    case 'processing':
      return 'PROCESSING';
    case 'completed':
    case 'succeeded':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    case 'expired':
      return 'EXPIRED';
    case 'cancelled':
    case 'canceled':
      return 'CANCELLED';
    case 'accepted':
      return 'ACCEPTED';
    case 'enqueued':
      return 'ENQUEUED';
    default:
      logger.warn('Statut interne non reconnu', { status });
      return 'WAITING_PAYMENT';
  }
}

export function mapMobileOperator(operator: string, country: string): string | null {
  const operatorMap: Record<string, Record<string, string>> = {
    CI: { MTN: 'MTN_MOMO_CIV', ORANGE: 'ORANGE_CIV', WAVE: 'WAVE_CIV' },
    BJ: { MTN: 'MTN_MOMO_BEN', MOOV: 'MOOV_BEN' },
    SN: { FREE: 'FREE_SEN', ORANGE: 'ORANGE_SEN', WAVE: 'WAVE_SEN' },
    CM: { MTN: 'MTN_MOMO_CMR', ORANGE: 'ORANGE_CMR' },
    BF: { MOOV: 'MOOV_BFA', ORANGE: 'ORANGE_BFA' },
    CG: { AIRTEL: 'AIRTEL_COG', MTN: 'MTN_MOMO_COG' },
    GA: { AIRTEL: 'AIRTEL_GAB', MTN: 'MTN_MOMO_GAB' },
  };

  const countryOperators = operatorMap[country.toUpperCase()];
  if (!countryOperators) {
    logger.warn('Pays non supporté pour le mapping des opérateurs', { country });
    return null;
  }

  const pawapayOperator = countryOperators[operator.toUpperCase()];
  if (!pawapayOperator) {
    logger.warn('Opérateur non supporté pour ce pays', { operator, country });
    return null;
  }

  return pawapayOperator;
}

export function mapFromPawapayOperator(
  code: string,
): { operator: string; country: string } | null {
  const reverseMap: Record<string, { operator: string; country: string }> = {
    MTN_MOMO_CIV: { operator: 'MTN', country: 'CI' },
    ORANGE_CIV: { operator: 'ORANGE', country: 'CI' },
    WAVE_CIV: { operator: 'WAVE', country: 'CI' },
    MTN_MOMO_BEN: { operator: 'MTN', country: 'BJ' },
    MOOV_BEN: { operator: 'MOOV', country: 'BJ' },
    FREE_SEN: { operator: 'FREE', country: 'SN' },
    ORANGE_SEN: { operator: 'ORANGE', country: 'SN' },
    WAVE_SEN: { operator: 'WAVE', country: 'SN' },
    MTN_MOMO_CMR: { operator: 'MTN', country: 'CM' },
    ORANGE_CMR: { operator: 'ORANGE', country: 'CM' },
    MOOV_BFA: { operator: 'MOOV', country: 'BF' },
    ORANGE_BFA: { operator: 'ORANGE', country: 'BF' },
    AIRTEL_COG: { operator: 'AIRTEL', country: 'CG' },
    MTN_MOMO_COG: { operator: 'MTN', country: 'CG' },
    AIRTEL_GAB: { operator: 'AIRTEL', country: 'GA' },
    MTN_MOMO_GAB: { operator: 'MTN', country: 'GA' },
  };

  const mapped = reverseMap[code];
  if (!mapped) {
    logger.warn('Code opérateur pawaPay non reconnu', { code });
    return null;
  }

  return mapped;
}

export function mapCurrency(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'XOF':
    case 'XAF':
    case 'GNF':
    case 'CDF':
    case 'EUR':
    case 'USD':
      return currency.toUpperCase();
    default:
      logger.warn('Devise non supportée', { currency });
      return currency.toUpperCase();
  }
}

export function mapCountryToISO3(country: string): string {
  const value = country.trim().toUpperCase();

  switch (value) {
    case 'CI':
      return 'CIV';
    case 'BJ':
      return 'BEN';
    case 'SN':
      return 'SEN';
    case 'CM':
      return 'CMR';
    case 'BF':
      return 'BFA';
    case 'CG':
      return 'COG';
    case 'GA':
      return 'GAB';
    case 'CD':
      return 'COD';
    // Un code ISO3 est déjà au bon format : ne pas le re-mapper ni logger.
    case 'CIV':
    case 'BEN':
    case 'SEN':
    case 'CMR':
    case 'BFA':
    case 'COG':
    case 'GAB':
    case 'COD':
      return value;
    default:
      if (/^[A-Z]{3}$/.test(value)) return value;
      logger.warn('Pays non supporté', { country });
      return value;
  }
}

export function mapFromISO3(iso3: string): string {
  switch (iso3.toUpperCase()) {
    case 'CIV':
      return 'CI';
    case 'BEN':
      return 'BJ';
    case 'SEN':
      return 'SN';
    case 'CMR':
      return 'CM';
    case 'BFA':
      return 'BF';
    case 'COG':
      return 'CG';
    case 'GAB':
      return 'GA';
    case 'COD':
      return 'CD';
    default:
      logger.warn('Code ISO3 non supporté', { iso3 });
      return iso3.toUpperCase();
  }
}

export function mapPaymentToPawapay(payment: any): any {
  return {
    checkoutId: payment.pawapay_checkout_id || undefined,
    depositId: payment.pawapay_deposit_id || undefined,
    refundId: payment.pawapay_refund_id || undefined,
    payoutId: payment.pawapay_payout_id || undefined,
    amount: payment.amount,
    currency: mapCurrency(payment.currency),
    status: mapToPawapayStatus(payment.status),
    pawapayStatus: payment.pawapay_status || undefined,
    pawapayFailureReason: payment.pawapay_failure_reason || undefined,
    failureCode: payment.failure_code || undefined,
    failureMessage: payment.failure_message || undefined,
    completedAt: payment.completed_at || undefined,
    pawapayDepositId: payment.pawapay_deposit_id || undefined,
    pawapayRefundId: payment.pawapay_refund_id || undefined,
    pawapayPayoutId: payment.pawapay_payout_id || undefined,
    pawapayRefundStatus: payment.pawapay_refund_status || undefined,
    pawapayPayoutStatus: payment.pawapay_payout_status || undefined,
    recipientType: payment.recipient_type || undefined,
    recipientPhone: payment.recipient_phone || undefined,
    recipientProvider: payment.recipient_provider || undefined,
  };
}

export function mapPaymentFromPawapay(pawapayData: any): any {
  return {
    reference: pawapayData.clientReferenceId || undefined,
    amount: pawapayData.amount,
    currency: mapCurrency(pawapayData.currency),
    status: mapPawapayStatus(pawapayData.status),
    pawapayStatus: pawapayData.status,
    pawapayCheckoutId: pawapayData.checkoutId,
    pawapayDepositId: pawapayData.depositId,
    pawapayRefundId: pawapayData.refundId,
    pawapayPayoutId: pawapayData.payoutId,
    pawapayFailureReason: pawapayData.failureReason,
    completedAt: pawapayData.completedAt,
    createdAt: pawapayData.createdAt,
    updatedAt: pawapayData.updatedAt,
    metadata: pawapayData.metadata || {},
  };
}