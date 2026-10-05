import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../config/supabase', () => ({
  supabaseAdmin: supabaseMock,
}));

async function importPurge() {
  return import('./notificationPurge');
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('purgeOldNotifications', () => {
  it('appelle la RPC avec la rétention de 30 jours par défaut', async () => {
    const { purgeOldNotifications } = await importPurge();
    await purgeOldNotifications();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('purge_old_notifications', {
      p_retention_days: 30,
    });
  });

  it('accepte une rétention explicite', async () => {
    const { purgeOldNotifications } = await importPurge();
    await purgeOldNotifications(7);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('purge_old_notifications', {
      p_retention_days: 7,
    });
  });

  it("journalise le nombre de lignes purgées quand il y en a", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ notifications_deleted: 12, client_notifications_deleted: 3 }],
      error: null,
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { purgeOldNotifications } = await importPurge();
    await purgeOldNotifications();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('15 notification(s) purgée(s)'));
    spy.mockRestore();
  });

  it("ne journalise rien quand rien n'a été purgé", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ notifications_deleted: 0, client_notifications_deleted: 0 }],
      error: null,
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { purgeOldNotifications } = await importPurge();
    await purgeOldNotifications();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("ne lève jamais quand la RPC renvoie une erreur", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'blocage RLS' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { purgeOldNotifications } = await importPurge();
    await expect(purgeOldNotifications()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('purge'), 'blocage RLS');
    spy.mockRestore();
  });

  it("ne lève jamais quand l'appel RPC rejette", async () => {
    supabaseMock.rpc.mockRejectedValue(new Error('réseau coupé'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { purgeOldNotifications } = await importPurge();
    await expect(purgeOldNotifications()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('startNotificationPurge', () => {
  it('purge après le délai initial puis à chaque intervalle', async () => {
    const { startNotificationPurge } = await importPurge();
    const stop = startNotificationPurge({ initialDelayMs: 1000, intervalMs: 5000 });

    expect(supabaseMock.rpc).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);

    stop();
  });

  it("s'arrête proprement : plus aucun appel après la désactivation", async () => {
    const { startNotificationPurge } = await importPurge();
    const stop = startNotificationPurge({ initialDelayMs: 1000, intervalMs: 5000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
  });
});
