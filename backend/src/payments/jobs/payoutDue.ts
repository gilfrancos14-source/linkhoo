/**
 * Reversements dus aux gérants (phase 4).
 *
 * Deux temps dans un même passage :
 *
 *   1. `scheduleDuePayouts` comptabilise le dû (aucun appel réseau) ;
 *   2. `processScheduledPayouts` envoie les transferts, puis
 *   3. `reconcileProcessingPayouts` relit ceux restés sans réponse.
 *
 * L'ordre est important : un transfert envoyé au tour précédent est réconcilié
 * avant qu'un nouveau lot ne soit émis, pour ne pas empiler des envois
 * incertains.
 */

import {
  processScheduledPayouts,
  reconcileProcessingPayouts,
  scheduleDuePayouts,
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
  const schedule = await scheduleDuePayouts(now);
  const reconcile = await reconcileProcessingPayouts(now);
  const process = await processScheduledPayouts(now);
  return { schedule, reconcile, process };
}
