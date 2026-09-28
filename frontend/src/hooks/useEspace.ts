import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { apiAuth, setAuthTokenGetter, type AuthRole } from '../lib/api';
import { useMarket } from '../contexts/MarketContext';

function readRole(meta: unknown): AuthRole | null {
  if (meta && typeof meta === 'object' && 'role' in meta) {
    const role = (meta as { role?: unknown }).role;
    if (role === 'client' || role === 'gerant') return role;
  }
  return null;
}

export function useEspace() {
  const navigate = useNavigate();
  const { market } = useMarket();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  const resolve = useCallback(async () => {
    const home = `/${market.toLowerCase()}`;

    if (!isLoaded || !isSignedIn) {
      navigate(`${home}/login`, { replace: true });
      return;
    }

    setLoading(true);
    try {
      let lastError: unknown = null;
      let role: AuthRole | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const me = await apiAuth.me();
          role = me.role;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      }

      if (!role) {
        role = readRole(user?.unsafeMetadata) ?? readRole(user?.publicMetadata);
        if (role) {
          try {
            await apiAuth.bootstrap({
              role,
              market: market === 'BJ' ? 'BJ' : 'CI',
            });
          } catch {
            // le guard de destination retentera le bootstrap
          }
        }
      }

      if (!role && lastError) {
        throw lastError;
      }

      navigate(role === 'gerant' ? `${home}/gerant` : `${home}/compte`, {
        replace: true,
      });
    } catch {
      navigate(`${home}/compte`, { replace: true });
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, market, navigate, user]);

  return { resolve, loading };
}
