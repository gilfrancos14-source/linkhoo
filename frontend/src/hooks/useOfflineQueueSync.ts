import { useEffect, useRef, useState } from 'react';
import { flushQueue, readQueue, type FlushHandlers } from '../lib/offlineQueue';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Synchronise la file d'attente hors-ligne : dès que la connexion revient,
 * les éléments en attente sont envoyés. Retourne le nombre d'éléments restants.
 */
export function useOfflineQueueSync(handlers: Partial<FlushHandlers> = {}): number {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(() => readQueue().length);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!online) {
      setPending(readQueue().length);
      return;
    }

    let cancelled = false;
    if (readQueue().length > 0) {
      void flushQueue(handlersRef.current).then((result) => {
        if (!cancelled) setPending(result.remaining);
      });
    } else {
      setPending(0);
    }

    return () => {
      cancelled = true;
    };
  }, [online]);

  return pending;
}
