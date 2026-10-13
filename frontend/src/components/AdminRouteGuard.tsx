import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  getAdminToken,
  apiAdmin,
  ADMIN_UNAUTHORIZED_EVENT,
  type AdminData,
} from '../lib/adminApi';
import { marketSlugFromPath } from '../contexts/MarketContext';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

function useAdmin(attempt: number) {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!getAdminToken()) {
      setAdmin(null);
      setNetworkError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNetworkError(false);
    apiAdmin.getMe()
      .then((data) => {
        if (!cancelled) setAdmin(data);
      })
      .catch(() => {
        if (cancelled) return;
        // 401 : adminApi a purgé le token (notifyUnauthorized) → login.
        // Erreur réseau/timeout : on ne déconnecte PAS, on montre un retry
        // (sinon F5 sur coupure 3 s = perte de session + URL profonde).
        if (!getAdminToken()) {
          setAdmin(null);
        } else {
          setNetworkError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const onUnauthorized = () => {
      setAdmin(null);
      setNetworkError(false);
      setLoading(false);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [attempt]);

  return { admin, loading, networkError };
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { pathname } = useLocation();
  const [attempt, setAttempt] = useState(0);
  const { admin, loading, networkError } = useAdmin(attempt);

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (!admin) {
    if (networkError) {
      return (
        <div className="auth-loading">
          <p role="alert">Impossible de vérifier la session admin. Vérifiez votre connexion.</p>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setAttempt((a) => a + 1)}>
            Réessayer
          </button>
        </div>
      );
    }
    const slug = marketSlugFromPath(pathname);
    const loginPath = slug ? `/${slug}/admin/login` : '/admin/login';
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
}
