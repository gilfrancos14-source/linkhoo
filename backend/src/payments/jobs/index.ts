/**
 * Ordonnanceur des travaux de paiement.
 *
 * Un seul passage, exécuté séquentiellement, pour borner la charge (chacun
 * interroge pawaPay) et profiter de l'ordre :
 *
 *   1. reconcile : un succès confirmé est activé avant toute expiration ;
 *   2. expire-unpaid : liens ouverts et dépassés → annulés ;
 *   3. expire-paid : réservations payées sans réponse → refund à 48 h ;
 *   4. cleanup-orphans : paiements sans `expires_at` (crash) → annulés ;
 *   5. payout-due : dû gérant comptabilisé, envoyé, réconcilié.
 *
 * Aucune étape ne fait échouer les suivantes : une panne provider ou une
 * erreur SQL est journalisée et retentée au prochain tour.
 *
 * ANTI-CHEVAUCHEMENT :
 *   Les ticks sont chaînés via `setTimeout` (au lieu de `setInterval`) avec
 *   un flag `running`. Si un passage dure > intervalMs, le suivant est
 *   simplement décalé — jamais lancé en parallèle.
 */

import { cleanupOrphanPayments } from './cleanupOrphanPayments';
import { expirePaidPendingBookings } from './expirePaidPending';
import { expireUnpaidBookings } from './expireUnpaid';
import { runPayoutDue } from './payoutDue';
import { reconcilePendingPayments } from './reconcile';

/** Assez court pour libérer les dates, assez long pour ne pas marteler le provider. */
export const PAYMENT_JOBS_INTERVAL_MS = 5 * 60 * 1000;

/** Le démarrage reste consacré au service ; le premier passage attend un peu. */
export const PAYMENT_JOBS_INITIAL_DELAY_MS = 60 * 1000;

async function runSafely(name: string, task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error(
      `[payments:jobs] ${name} :`,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Exécute un passage complet (utile aux tests et au back-office). */
export async function runPaymentJobs(now: Date = new Date()): Promise<void> {
  await runSafely('reconcile', () => reconcilePendingPayments(now));
  await runSafely('expire-unpaid', () => expireUnpaidBookings(now));
  await runSafely('expire-paid', () => expirePaidPendingBookings(now));
  await runSafely('cleanup-orphans', () => cleanupOrphanPayments(now));
  await runSafely('payout-due', () => runPayoutDue(now));
}

export interface PaymentJobsOptions {
  readonly initialDelayMs?: number;
  readonly intervalMs?: number;
}

/**
 * Démarre l'ordonnanceur. Timers unref : le process peut s'arrêter.
 * Retourne la fonction d'arrêt (tests, arrêt propre).
 *
 * Anti-chevauchement : les ticks sont chaînés via `setTimeout` (au lieu de
 * `setInterval`) avec un flag `running`. Un tick trop long décale le suivant,
 * sans jamais en lancer un second en parallèle.
 */
export function startPaymentJobs(options: PaymentJobsOptions = {}): () => void {
  const initialDelayMs = options.initialDelayMs ?? PAYMENT_JOBS_INITIAL_DELAY_MS;
  const intervalMs = options.intervalMs ?? PAYMENT_JOBS_INTERVAL_MS;

  let stopped = false;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await runPaymentJobs();
    } finally {
      running = false;
      if (!stopped) {
        timer = setTimeout(() => void tick(), intervalMs);
        timer.unref();
      }
    }
  };

  timer = setTimeout(() => void tick(), initialDelayMs);
  timer.unref();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}