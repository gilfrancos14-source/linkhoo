import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useOfflineQueueSync } from './useOfflineQueueSync';
import { clearQueue, enqueue, readQueue } from '../lib/offlineQueue';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  cleanup();
  setOnline(true);
  clearQueue();
});

describe('useOfflineQueueSync', () => {
  beforeEach(() => {
    setOnline(true);
    clearQueue();
  });

  it('annonce zéro élément en attente quand la file est vide', () => {
    const { result } = renderHook(() => useOfflineQueueSync());

    expect(result.current).toBe(0);
  });

  it('reste silencieux tant que la connexion est absente', () => {
    setOnline(false);
    enqueue({ type: 'newsletter', payload: { email: 'awa@example.com' } });
    const newsletter = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useOfflineQueueSync({ newsletter }));

    expect(result.current).toBe(1);
    expect(newsletter).not.toHaveBeenCalled();
  });

  it('envoie la file au retour de la connexion', async () => {
    setOnline(false);
    enqueue({ type: 'newsletter', payload: { email: 'awa@example.com' } });
    const newsletter = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOfflineQueueSync({ newsletter }));

    expect(result.current).toBe(1);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current).toBe(0));
    expect(newsletter).toHaveBeenCalledWith({ email: 'awa@example.com' });
    expect(readQueue()).toEqual([]);
  });

  it('ne tente rien au montage en ligne sans élément en attente', async () => {
    const newsletter = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useOfflineQueueSync({ newsletter }));

    await waitFor(() => expect(newsletter).not.toHaveBeenCalled());
    expect(readQueue()).toEqual([]);
  });
});
