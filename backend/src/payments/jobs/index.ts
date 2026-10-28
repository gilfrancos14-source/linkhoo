/**
 * Ordonnanceur des travaux de paiement.
 *
 * Un seul passage, exécuté séquentiellement, pour borner la charge (chacun
 * interroge Hub2) et pour profiter de l'ordre :
 *
 *   1. réconciliation : un succès confirmé est activé avant toute expiration ;
 *   2. expiration des liens : ce qui reste ouvert et dépassé est annulé ;
 *   3. réservations payées sans réponse : remboursement à 48 h ;
 *   4. reversements : dû comptabilisé, transferts envoyés, puis réconciliés.
 *
 * Aucune étape ne fait échouer les suivantes : une panne Hub2 ou une erreur
 * SQL est journalisée et retentée au prochain tour.
 */

import { expirePaidPendingBookings } from './expirePaidPending';
import { expireUnpaidBookings } from './expireUnpaid';
import { runPayoutDue } from './payoutDue';
import { reconcilePendingPayments } from './reconcile';

/** Fréquence par défaut : assez court pour libérer les dates, assez long pour ne pas marteler Hub2. */
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
  await runSafely('payout-due', () => runPayoutDue(now));
}

export interface PaymentJobsOptions {
  readonly initialDelayMs?: number;
  readonly intervalMs?: number;
}

/**
 * Démarre l'ordonnanceur. Les timers sont unref : ils ne retiennent jamais
 * le process Node ouvert. Retourne la fonction d'arrêt (tests, arrêt propre).
 */
export function startPaymentJobs(options: PaymentJobsOptions = {}): () => void {
  const initialDelayMs = options.initialDelayMs ?? PAYMENT_JOBS_INITIAL_DELAY_MS;
  const intervalMs = options.intervalMs ?? PAYMENT_JOBS_INTERVAL_MS;

  const run = () => {
    void runPaymentJobs();
  };
  const first = setTimeout(run, initialDelayMs);
  const periodic = setInterval(run, intervalMs);
  first.unref();
  periodic.unref();

  return () => {
    clearTimeout(first);
    clearInterval(periodic);
  };
}
