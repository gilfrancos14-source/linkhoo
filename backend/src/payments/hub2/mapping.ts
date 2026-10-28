/**
 * Traduction des valeurs Hub2 vers le vocabulaire interne.
 *
 * Le reste du backend ne connaît que `PaymentStatus`, `RefundStatus` et
 * `TransferStatus` : un changement de prestataire ne doit pas se propager
 * dans les routes ni dans la base.
 *
 * Les fonctions renvoient `null` pour une valeur inconnue. L'appelant décide
 * alors de conserver l'état courant : une nouvelle valeur Hub2 ne doit jamais
 * faire régresser un paiement déjà réussi.
 */

import type { PaymentStatus, RefundStatus, TransferStatus } from '../types';

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  created: 'created',
  pending: 'pending',
  payment_required: 'requires_action',
  action_required: 'requires_action',
  processing: 'pending',
  successful: 'succeeded',
  succeeded: 'succeeded',
  failed: 'failed',
  canceled: 'canceled',
  cancelled: 'canceled',
  expired: 'expired',
};

const REFUND_STATUS_MAP: Record<string, RefundStatus> = {
  created: 'requested',
  requested: 'requested',
  pending: 'processing',
  processing: 'processing',
  successful: 'succeeded',
  succeeded: 'succeeded',
  failed: 'failed',
  pending_manual: 'manual_required',
  manual: 'manual_required',
  manual_required: 'manual_required',
  canceled: 'canceled',
  cancelled: 'canceled',
};

const TRANSFER_STATUS_MAP: Record<string, TransferStatus> = {
  created: 'scheduled',
  scheduled: 'scheduled',
  pending: 'scheduled',
  processing: 'processing',
  successful: 'paid',
  succeeded: 'paid',
  paid: 'paid',
  failed: 'failed',
  canceled: 'canceled',
  cancelled: 'canceled',
};

function normalize(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

export function mapPaymentStatus(value: unknown): PaymentStatus | null {
  const key = normalize(value);
  return key ? PAYMENT_STATUS_MAP[key] ?? null : null;
}

export function mapRefundStatus(value: unknown): RefundStatus | null {
  const key = normalize(value);
  return key ? REFUND_STATUS_MAP[key] ?? null : null;
}

export function mapTransferStatus(value: unknown): TransferStatus | null {
  const key = normalize(value);
  return key ? TRANSFER_STATUS_MAP[key] ?? null : null;
}

/**
 * Effet métier d'un événement webhook.
 *
 * Volontairement grossier : la route stocke d'abord, applique ensuite. Un
 * événement non listé est `unknown` et sera journalisé sans effet.
 */
export type EventKind =
  | 'payment_created'
  | 'payment_processing'
  | 'payment_requires_action'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_canceled'
  | 'payment_expired'
  | 'refund_processing'
  | 'refund_succeeded'
  | 'refund_failed'
  | 'refund_manual'
  | 'transfer_processing'
  | 'transfer_succeeded'
  | 'transfer_failed'
  | 'unknown';

const EVENT_KIND_MAP: Record<string, EventKind> = {
  'payment_intent.created': 'payment_created',
  'payment_intent.processing': 'payment_processing',
  'payment_intent.action_required': 'payment_requires_action',
  'payment_intent.payment_required': 'payment_requires_action',
  'payment_intent.succeeded': 'payment_succeeded',
  'payment_intent.successful': 'payment_succeeded',
  'payment_intent.payment_failed': 'payment_failed',
  'payment_intent.failed': 'payment_failed',
  'payment_intent.canceled': 'payment_canceled',
  'payment_intent.expired': 'payment_expired',

  // Événements de paiement unitaire. Ils ne portent pas toujours
  // `purchaseReference` (seulement `intentId`) : ils sont reconnus pour ne pas
  // être traités comme « inconnus », mais l'effet métier nominal vient de
  // `payment_intent.*` ou `payment_links.*`.
  'payment.created': 'payment_created',
  'payment.pending': 'payment_processing',
  'payment.processing': 'payment_processing',
  'payment.action_required': 'payment_requires_action',
  'payment.succeeded': 'payment_succeeded',
  'payment.successful': 'payment_succeeded',
  'payment.failed': 'payment_failed',
  'payment.canceled': 'payment_canceled',
  'payment.expired': 'payment_expired',

  // Payment Links : le lien porte `purchaseReference`, c'est donc une source
  // fiable même si l'abonnement webhook n'inclut pas `payment_intent.*`.
  'payment_links.created': 'payment_created',
  'payment_links.paid': 'payment_succeeded',
  'payment_links.completed': 'payment_succeeded',
  'payment_links.expired': 'payment_expired',
  'payment_links.closed': 'payment_canceled',

  'payment_refund.created': 'refund_processing',
  'payment_refund.processing': 'refund_processing',
  'payment_refund.pending': 'refund_processing',
  'payment_refund.successful': 'refund_succeeded',
  'payment_refund.succeeded': 'refund_succeeded',
  'payment_refund.failed': 'refund_failed',
  'payment_refund.pending_manual': 'refund_manual',

  'refund.created': 'refund_processing',
  'refund.pending': 'refund_processing',
  'refund.successful': 'refund_succeeded',
  'refund.failed': 'refund_failed',
  'refund.pending_manual': 'refund_manual',

  'transfer.created': 'transfer_processing',
  'transfer.processing': 'transfer_processing',
  'transfer.successful': 'transfer_succeeded',
  'transfer.succeeded': 'transfer_succeeded',
  'transfer.failed': 'transfer_failed',
};

export function eventKind(eventType: unknown): EventKind {
  const key = normalize(eventType);
  return key ? EVENT_KIND_MAP[key] ?? 'unknown' : 'unknown';
}

/**
 * Une transition ne doit jamais faire régresser un état terminal.
 *
 * Exemple concret : Hub2 peut livrer `payment_intent.succeeded` avant
 * `payment_intent.processing` (webhooks dans le désordre). Sans cette garde,
 * le second écraserait `succeeded` par `pending`.
 */
const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  'succeeded',
  'failed',
  'canceled',
  'expired',
]);

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.has(status);
}

/** Vrai si `next` peut remplacer `current` sans régression. */
export function canTransitionPayment(current: PaymentStatus, next: PaymentStatus): boolean {
  if (current === next) return false;
  if (current === 'succeeded') return false;
  if (isTerminalPaymentStatus(current) && next !== 'succeeded') return false;
  return true;
}
