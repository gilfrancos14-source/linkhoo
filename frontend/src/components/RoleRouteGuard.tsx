import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { apiAuth, setAuthTokenGetter, type AuthRole } from '../lib/api';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

// Routes de sortie par rôle : le rôle attendu décide où rediriger quand
// l'utilisateur n'est pas connecté ou possède un autre rôle.
const rolePaths: Record<AuthRole, { login: (m: string) => string; wrongRole: (m: string) => string }> = {
  client: {
    login: (m) => `/${m}/login`,
    wrongRole: (m) => `/${m}/gerant`,
  },
  gerant: {
    login: (m) => `/${m}/login/gerant`,
    wrongRole: (m) => `/${m}/compte`,
  },
};

function Loading() {
  return (
    <div className="auth-loading">
      <div className="auth-loading__spinner" />
      <p>Chargement...</p>
    </div>
  );
}

// Hooks Clerk uniquement ici : ce composant n'est jamais rendu quand Clerk
// n'est pas configuré, donc useAuth()/useClerk() restent sous le provider.
function AuthenticatedGuard({
  children,
  expectedRole,
  loginPath,
  wrongRolePath,
}: {
  children: React.ReactNode;
  expectedRole: AuthRole;
  loginPath: string;
  wrongRolePath: string;
}) {
  const { market } = useParams<{ market: string }>();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { signOut } = useClerk();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'wrong-role'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    const ensure = async (retryCount = 0) => {
      try {
        const result = await apiAuth.bootstrap({
          role: expectedRole,
          market: (market?.toUpperCase() === 'BJ' ? 'BJ' : 'CI') as 'CI' | 'BJ',
        });
        if (cancelled) return;

        if (result.role !== expectedRole) {
          setStatus('wrong-role');
          return;
        }
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : '';
        if (errorMessage.includes(expectedRole === 'client' ? 'gerant' : 'client')) {
          setStatus('wrong-role');
          return;
        }
        if (retryCount < 2) {
          await new Promise((r) => setTimeout(r, 800));
          if (!cancelled) await ensure(retryCount + 1);
          return;
        }
        setMessage(errorMessage || 'Impossible de vérifier votre compte.');
        setStatus('error');
      }
    };

    ensure();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, expectedRole, market, retryToken]);

  const handleRetry = () => {
    setMessage(null);
    setStatus('loading');
    setRetryToken((n) => n + 1);
  };

  const handleSignOut = () => {
    void signOut();
  };

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <Navigate to={loginPath} replace />;
  if (status === 'loading') return <Loading />;
  if (status === 'wrong-role') return <Navigate to={wrongRolePath} replace />;

  if (status === 'error') {
    return (
      <div className="auth-loading">
        <div className="auth-error" role="alert">{message}</div>
        <div className="auth-error-actions">
          <button type="button" className="auth-btn auth-btn--primary" onClick={handleRetry}>
            Réessayer
          </button>
          <button type="button" className="auth-btn auth-btn--primary" onClick={handleSignOut}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface RoleRouteGuardProps {
  role: AuthRole;
  children: React.ReactNode;
}

export default function RoleRouteGuard({ role, children }: RoleRouteGuardProps) {
  const { market } = useParams<{ market: string }>();
  const currentMarket = (market ?? 'ci').toLowerCase();

  if (!clerkConfigured) {
    return <Navigate to={`/${currentMarket}`} replace />;
  }

  const paths = rolePaths[role];

  return (
    <AuthenticatedGuard
      expectedRole={role}
      loginPath={paths.login(currentMarket)}
      wrongRolePath={paths.wrongRole(currentMarket)}
    >
      {children}
    </AuthenticatedGuard>
  );
}
