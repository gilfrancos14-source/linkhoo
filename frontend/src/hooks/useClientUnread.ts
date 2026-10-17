import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiMessages, setAuthTokenGetter } from '../lib/api';

const POLL_INTERVAL_MS = 30_000;

/**
 * Compteur de messages non lus, pour la pastille « Messages » du rail de
 * l'espace client.
 *
 * Monté uniquement sur des pages verrouillées par `RoleRouteGuard
 * role="client"` : l'appel ne part donc que pour un client identifié, et le
 * compteur retombe à zéro dès que Clerk n'est plus authentifié.
 */
export function useClientUnread(): number {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUnread(0);
      return;
    }

    setAuthTokenGetter(() => getTokenRef.current());
    let cancelled = false;

    const load = async () => {
      try {
        const { count } = await apiMessages.unread();
        if (!cancelled) setUnread(count);
      } catch {
        // Échec réseau transitoire : on conserve le dernier compteur connu.
      }
    };

    void load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLoaded, isSignedIn]);

  return unread;
}
