/**
 * Gestion des dépôts pawaPay.
 *
 * Un dépôt représente un paiement réussi sur pawaPay. Ce module permet de
 * récupérer les informations d'un dépôt et de mettre à jour le paiement
 * correspondant dans la base de données.
 */

import { supabaseAdmin } from '../../config/supabase';
import { getPawapayConfig } from './config';
import { PawapayClient } from './client';
import { logger } from '../../lib/logger';
import { PaymentServiceError } from '../errors';
import type { DepositLookupResult, DepositResource } from './types';

export type PawapayDeposit = DepositResource;

/**
 * Récupère les informations d'un dépôt pawaPay.
 *
 * @param depositId - L'ID du dépôt (UUID 36 caractères)
 * @returns Les informations du dépôt
 * @throws PaymentServiceError si le dépôt est introuvable
 */
export async function getDeposit(depositId: string): Promise<DepositResource> {
  const config = getPawapayConfig();
  const client = new PawapayClient(config);

  const lookup = await client.getDepositStatus(depositId);

  if (lookup.status !== 'FOUND') {
    throw new PaymentServiceError(
      'PAYMENT_NOT_FOUND',
      `Dépôt pawaPay introuvable : ${depositId}`,
      404,
      { depositId },
    );
  }

  return lookup.data;
}

/**
 * Met à jour un paiement avec les informations d'un dépôt complété.
 */
export async function updatePaymentWithDeposit(
  paymentReference: string,
  deposit: DepositResource,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: deposit.status === 'COMPLETED' ? 'succeeded' : 'failed',
      pawapay_status: deposit.status,
      pawapay_deposit_id: deposit.depositId,
      pawapay_failure_reason: deposit.failureReason?.failureMessage ?? null,
      paid_at: deposit.status === 'COMPLETED' ? deposit.created : null,
      failure_code: deposit.failureReason?.failureCode ?? null,
      failure_message: deposit.failureReason?.failureMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('reference', paymentReference);

  if (updateError) {
    throw new PaymentServiceError(
      'PAYMENT_UPDATE_FAILED',
      `Impossible de mettre à jour le paiement : ${updateError.message}`,
      500,
      { reference: paymentReference },
    );
  }

  logger.info('Paiement mis à jour avec le dépôt', {
    paymentReference,
    depositId: deposit.depositId,
    status: deposit.status,
  });
}

/**
 * Vérifie si un dépôt est complété et met à jour le paiement correspondant.
 *
 * @returns true si le dépôt est complété, false sinon
 */
export async function checkAndCompleteDeposit(
  paymentReference: string,
  depositId: string,
): Promise<boolean> {
  const deposit = await getDeposit(depositId);

  if (deposit.status === 'COMPLETED') {
    await updatePaymentWithDeposit(paymentReference, deposit);
    return true;
  }

  return false;
}

/**
 * Récupère tous les paiements en attente de dépôt complété.
 */
export async function getPendingDeposits(): Promise<
  Array<{
    id: string;
    reference: string;
    pawapay_checkout_id: string;
    pawapay_deposit_id?: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, reference, pawapay_checkout_id, pawapay_deposit_id')
    .eq('status', 'pending')
    .eq('provider', 'pawapay')
    .not('pawapay_checkout_id', 'is', null)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    throw new PaymentServiceError(
      'PAYMENT_FETCH_FAILED',
      `Impossible de récupérer les paiements en attente : ${error.message}`,
      500,
    );
  }

  return (data as Array<{
    id: string;
    reference: string;
    pawapay_checkout_id: string;
    pawapay_deposit_id?: string;
  }>) ?? [];
}

/**
 * Synchronise les dépôts pawaPay avec les paiements en attente.
 *
 * Lookup d'un checkout par son ID (`GET /v2/checkouts/{id}`) : pawaPay
 * n'expose pas de recherche par référence.
 *
 * @returns Le nombre de paiements mis à jour
 */
export async function syncPendingDeposits(): Promise<number> {
  let updatedCount = 0;

  const pendingPayments = await getPendingDeposits();
  if (pendingPayments.length === 0) return 0;

  const config = getPawapayConfig();
  const client = new PawapayClient(config);

  for (const payment of pendingPayments) {
    try {
      const lookup = await client.getCheckoutStatus(payment.pawapay_checkout_id);
      if (lookup.status !== 'FOUND') continue;

      const checkout = lookup.data;
      if (checkout.status !== 'COMPLETED') continue;

      const completedDeposit =
        checkout.depositsHistory?.find((d) => d.status === 'COMPLETED') ?? checkout.deposit;

      if (completedDeposit?.depositId) {
        await updatePaymentWithDeposit(payment.reference, await getDeposit(completedDeposit.depositId));
        updatedCount++;
      }
    } catch (error) {
      logger.error("Erreur lors de la synchronisation d'un dépôt", {
        error,
        paymentReference: payment.reference,
      });
      // Continuer avec les autres paiements
    }
  }

  logger.info('Synchronisation des dépôts terminée', { updatedCount });
  return updatedCount;
}

export type { DepositLookupResult, DepositResource };
