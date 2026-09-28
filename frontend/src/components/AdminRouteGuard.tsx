import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAdminToken, apiAdmin, type AdminData } from '../lib/adminApi';
import { marketSlugFromPath } from '../contexts/MarketContext';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

function useAdmin() {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiAdmin.getMe()
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  return { admin, loading };
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { pathname } = useLocation();
  const { admin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (!admin) {
    const slug = marketSlugFromPath(pathname);
    const loginPath = slug ? `/${slug}/admin/login` : '/admin/login';
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
}
