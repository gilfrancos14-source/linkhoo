/**
 * Reversements dus aux gérants.
 *
 * pawaPay fonctionne en portefeuille : un séjour terminé crédite le solde du
 * gérant, et c'est sa demande de retrait qui crée le payout de retrait. Les
 * reversements de fin de séjour, eux, sont créés automatiquement : le job
 * les programme dès que le séjour est terminé et le délai de sécurité
 * écoulé.
 *
 * L'ordre reste : réconcilier avant d'émettre, pour ne pas empiler des envois
 * incertains.
 */

import {
  processScheduledPayoutsPawapay,
  reconcileProcessingPayoutsPawapay,
  scheduleDuePayoutsPawapay,
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
  // 1. Créer les reversements dus (séjour terminé + délai de sécurité).
  const schedule = await scheduleDuePayoutsPawapay(now);
  // 2. Reconcilier les envois en cours (statut incertain côté pawaPay).
  const reconcile = await reconcileProcessingPayoutsPawapay(now);
  // 3. Envoyer les reversements programmés (retraits demandés par le gérant
  //    et reversements de fin de séjour).
  const process = await processScheduledPayoutsPawapay(now);
  return { schedule, reconcile, process };
}
