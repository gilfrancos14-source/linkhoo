import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPaymentJobs, startPaymentJobs } from './index';
import { reconcilePendingPayments } from './reconcile';
import { expireUnpaidBookings } from './expireUnpaid';
import { expirePaidPendingBookings } from './expirePaidPending';
import { runPayoutDue } from './payoutDue';

vi.mock('./reconcile', () => ({ reconcilePendingPayments: vi.fn() }));
vi.mock('./expireUnpaid', () => ({ expireUnpaidBookings: vi.fn() }));
vi.mock('./expirePaidPending', () => ({ expirePaidPendingBookings: vi.fn() }));
vi.mock('./payoutDue', () => ({ runPayoutDue: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(reconcilePendingPayments).mockResolvedValue({
    checked: 0,
    claimed: 0,
    closed: 0,
    skipped: false,
  });
  vi.mocked(expireUnpaidBookings).mockResolvedValue({
    checked: 0,
    expired: 0,
    claimed: 0,
    cancelledReservations: 0,
    skipped: false,
  });
  vi.mocked(expirePaidPendingBookings).mockResolvedValue({
    checked: 0,
    cancelled: 0,
    blocked: 0,
  });
  vi.mocked(runPayoutDue).mockResolvedValue({
    schedule: { skipped: false, checked: 0, created: 0, blocked: 0 },
    reconcile: { skipped: false, checked: 0, updated: 0, requeued: 0 },
    process: { skipped: false, checked: 0, sent: 0, paid: 0, failed: 0, deferred: 0 },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runPaymentJobs', () => {
  it('réconcilie avant d’expirer les liens', async () => {
    await runPaymentJobs();

    expect(reconcilePendingPayments).toHaveBeenCalledTimes(1);
    expect(expireUnpaidBookings).toHaveBeenCalledTimes(1);
    expect(expirePaidPendingBookings).toHaveBeenCalledTimes(1);
    expect(runPayoutDue).toHaveBeenCalledTimes(1);
  });

  it('poursuit les autres jobs quand l’un échoue', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(reconcilePendingPayments).mockRejectedValue(new Error('Hub2 indisponible'));

    await runPaymentJobs();

    expect(expireUnpaidBookings).toHaveBeenCalledTimes(1);
    expect(expirePaidPendingBookings).toHaveBeenCalledTimes(1);
    expect(runPayoutDue).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('startPaymentJobs', () => {
  it('exécute un passage après le délai initial puis à chaque intervalle', async () => {
    const stop = startPaymentJobs({ initialDelayMs: 1000, intervalMs: 5000 });

    expect(reconcilePendingPayments).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(reconcilePendingPayments).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(reconcilePendingPayments).toHaveBeenCalledTimes(2);

    stop();
  });

  it('s’arrête proprement', async () => {
    const stop = startPaymentJobs({ initialDelayMs: 1000, intervalMs: 5000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(reconcilePendingPayments).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(reconcilePendingPayments).toHaveBeenCalledTimes(1);
  });
});
