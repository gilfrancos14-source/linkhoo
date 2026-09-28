export type PremiumTxStatus = 'pending' | 'approved' | 'declined' | 'canceled' | 'refunded' | 'expired';

export function mapFedaPayStatus(raw: unknown): PremiumTxStatus {
  const s = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (!s) return 'pending';
  if (s === 'approved' || s === 'paid' || s === 'transferred' || s === 'success' || s === 'succeeded') return 'approved';
  if (s === 'declined' || s === 'failed' || s === 'failure' || s === 'error') return 'declined';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  if (s === 'refunded' || s === 'partially_refunded') return 'refunded';
  if (s === 'expired' || s === 'timeout' || s === 'timed_out') return 'expired';
  return 'pending';
}

export function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as any;
  const status = anyErr.httpStatus ?? anyErr.statusCode ?? anyErr.status;
  if (status === 404) return true;
  const message = String(anyErr.message || '').toLowerCase();
  return message.includes('not found') || message.includes('introuvable') || message.includes('404');
}
