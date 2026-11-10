/**
 * Utilitaires d'identifiants pawaPay.
 *
 * pawaPay exige des UUID v4 de 36 caractères, générés par nos soins et
 * persistés AVANT l'appel réseau (idempotence).
 */

import { randomUUID } from 'node:crypto';

/** Identifiant de checkout (`POST /v2/checkouts`). */
export function createCheckoutId(): string {
  return randomUUID();
}

/** Identifiant de remboursement (`POST /v2/refunds`). */
export function createRefundId(): string {
  return randomUUID();
}

/** Identifiant de virement (`POST /v2/payouts`). */
export function createPayoutId(): string {
  return randomUUID();
}
