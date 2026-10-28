import { describe, expect, it } from 'vitest';
import {
  canTransitionPayment,
  eventKind,
  isTerminalPaymentStatus,
  mapPaymentStatus,
  mapRefundStatus,
  mapTransferStatus,
} from './mapping';

describe('mapPaymentStatus', () => {
  it('traduit les statuts Hub2 connus', () => {
    expect(mapPaymentStatus('successful')).toBe('succeeded');
    expect(mapPaymentStatus('processing')).toBe('pending');
    expect(mapPaymentStatus('action_required')).toBe('requires_action');
    expect(mapPaymentStatus('payment_required')).toBe('requires_action');
    expect(mapPaymentStatus('failed')).toBe('failed');
    expect(mapPaymentStatus('canceled')).toBe('canceled');
    expect(mapPaymentStatus('expired')).toBe('expired');
  });

  it('ignore la casse et les espaces', () => {
    expect(mapPaymentStatus('  SUCCESSFUL ')).toBe('succeeded');
  });

  it('renvoie null pour une valeur inconnue ou absente', () => {
    expect(mapPaymentStatus('refunded_later')).toBeNull();
    expect(mapPaymentStatus(undefined)).toBeNull();
    expect(mapPaymentStatus(42)).toBeNull();
  });
});

describe('mapRefundStatus', () => {
  it('traduit les statuts de remboursement', () => {
    expect(mapRefundStatus('processing')).toBe('processing');
    expect(mapRefundStatus('successful')).toBe('succeeded');
    expect(mapRefundStatus('failed')).toBe('failed');
    expect(mapRefundStatus('pending_manual')).toBe('manual_required');
    expect(mapRefundStatus('canceled')).toBe('canceled');
  });
});

describe('mapTransferStatus', () => {
  it('traduit les statuts de reversement', () => {
    expect(mapTransferStatus('created')).toBe('scheduled');
    expect(mapTransferStatus('processing')).toBe('processing');
    expect(mapTransferStatus('successful')).toBe('paid');
    expect(mapTransferStatus('failed')).toBe('failed');
  });
});

describe('eventKind', () => {
  it('classe les événements de paiement', () => {
    expect(eventKind('payment_intent.succeeded')).toBe('payment_succeeded');
    expect(eventKind('payment_intent.payment_failed')).toBe('payment_failed');
    expect(eventKind('payment_intent.action_required')).toBe('payment_requires_action');
  });

  it('classe les événements de paiement unitaire', () => {
    expect(eventKind('payment.pending')).toBe('payment_processing');
    expect(eventKind('payment.succeeded')).toBe('payment_succeeded');
    expect(eventKind('payment.failed')).toBe('payment_failed');
  });

  it('classe les événements de Payment Link', () => {
    expect(eventKind('payment_links.paid')).toBe('payment_succeeded');
    expect(eventKind('payment_links.completed')).toBe('payment_succeeded');
    expect(eventKind('payment_links.expired')).toBe('payment_expired');
    expect(eventKind('payment_links.closed')).toBe('payment_canceled');
  });

  it('classe les événements de remboursement et de transfert', () => {
    expect(eventKind('payment_refund.successful')).toBe('refund_succeeded');
    expect(eventKind('payment_refund.pending_manual')).toBe('refund_manual');
    expect(eventKind('refund.successful')).toBe('refund_succeeded');
    expect(eventKind('refund.pending_manual')).toBe('refund_manual');
    expect(eventKind('transfer.succeeded')).toBe('transfer_succeeded');
  });

  it('renvoie unknown plutôt que de deviner', () => {
    expect(eventKind('payment_intent.something_new')).toBe('unknown');
    expect(eventKind(null)).toBe('unknown');
  });
});

describe('transitions', () => {
  it('ne rétrograde jamais un paiement réussi', () => {
    expect(canTransitionPayment('succeeded', 'pending')).toBe(false);
    expect(canTransitionPayment('succeeded', 'failed')).toBe(false);
    expect(canTransitionPayment('succeeded', 'succeeded')).toBe(false);
  });

  it('autorise une réussite après un échec (nouvelle tentative)', () => {
    expect(canTransitionPayment('failed', 'succeeded')).toBe(true);
    expect(canTransitionPayment('requires_action', 'succeeded')).toBe(true);
  });

  it('interdit de quitter un état terminal autrement que par un succès', () => {
    expect(canTransitionPayment('failed', 'pending')).toBe(false);
    expect(canTransitionPayment('canceled', 'requires_action')).toBe(false);
  });

  it('identifie les états terminaux', () => {
    expect(isTerminalPaymentStatus('succeeded')).toBe(true);
    expect(isTerminalPaymentStatus('failed')).toBe(true);
    expect(isTerminalPaymentStatus('pending')).toBe(false);
  });
});
