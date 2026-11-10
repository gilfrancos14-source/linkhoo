/**
 * Reversements dus aux gérants (phase 4).
 *
 * pawaPay fonctionne en portefeuille : un séjour terminé crédite le solde du
 * gérant, et c'est sa demande de retrait qui crée le payout. Aucun versement
 * automatique n'est donc programmé.
 *
 * L'ordre reste : réconcilier avant d'émettre, pour ne pas empiler des envois
 * incertains.
 */

import {
  processScheduledPayoutsPawapay,
  reconcileProcessingPayoutsPawapay,
  type ProcessResult,
  type ReconcilePayoutsResult,
  type ScheduleResult,
} from '../service/payout';

export interface PayoutDueResult {
  readonly schedule: ScheduleResult;
  readonly reconcile: ReconcilePayoutsResult;
  readonly process: ProcessResult;
}

export async function runPayoutDue(now: Date = new Date()): Promise<PayoutDueResult> {
  const reconcile = await reconcileProcessingPayoutsPawapay(now);
  const process = await processScheduledPayoutsPawapay(now);
  return {
    schedule: { skipped: true, checked: 0, created: 0, blocked: 0 },
    reconcile,
    process,
  };
}
