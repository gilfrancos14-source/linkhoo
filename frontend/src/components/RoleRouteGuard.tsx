import { isMarketCode, type MarketCode } from '../config/markets';

import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { apiAuth, setAuthTokenGetter, ApiError, type AuthRole } from '../lib/api';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

/**
 * Ne réessayer que les erreurs transitoires (réseau, 5xx, timeout). Un 4xx est
 * définitif : rejouer un 401/403/429 ne fait qu'aggraver le blocage côté serveur
 * (chaque tentative consomme la limite) et retarde l'affichage de l'erreur.
 */
function isTransientError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500 || err.status === 408;
  return true;
}

// Routes de sortie par rôle : le rôle attendu décide où rediriger quand
// l'utilisateur n'est pas connecté ou possède un autre rôle.
const rolePaths: Record<
  AuthRole,
  {
    login: (m: string) => string;
    wrongRole: (m: string) => string;
    /** Espace du même rôle sur le marché réel du compte (409 mauvais marché). */
    wrongMarket: (m: string) => string;
  }
> = {
  client: {
    login: (m) => `/${m}/login`,
    wrongRole: (m) => `/${m}/gerant`,
    wrongMarket: (m) => `/${m}/compte`,
  },
  gerant: {
    login: (m) => `/${m}/login/gerant`,
    wrongRole: (m) => `/${m}/compte`,
    wrongMarket: (m) => `/${m}/gerant`,
  },
};

/**
 * Budget de redirections d'authentification pour la session.
 *
 * Une garde correcte redirige AU PLUS une fois avant d'atteindre un espace
 * stable (qui réinitialise le budget). Dépasser ce plafond signifie qu'une
 * boucle s'est installée : on s'arrête sur une erreur explicite plutôt que de
 * faire tourner le navigateur indéfiniment. Filet de sécurité volontairement
 * hors de React : il doit survivre au recyclage d'instance entre `/compte` et
 * `/gerant` (même type de composant à la même position dans l'arbre).
 */
const MAX_AUTH_REDIRECTS = 4;
let authRedirectBudget = 0;

/** À appeler dans les tests pour isoler le budget entre les cas. */
export function resetAuthRedirectBudget(): void {
  authRedirectBudget = 0;
}

import { LoadingScreen } from './LoadingComponents/LoadingSpinner';

function Loading() {
  return <LoadingScreen message="Authentification..." submessage="Veuillez patienter pendant que nous vérifions vos informations" />;
}

function ErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="auth-loading">
      <div className="auth-error" role="alert">{message}</div>
      <div className="auth-error-actions">
        <button type="button" className="auth-btn auth-btn--primary" onClick={onRetry}>
          Réessayer
        </button>
        <button type="button" className="auth-btn auth-btn--primary" onClick={onSignOut}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

/** Résultat de bootstrap pour UNE identité (rôle attendu + marché d'URL). */
export type GuardOutcome =
  | { kind: 'ready' }
  | { kind: 'wrong-role' }
  | { kind: 'wrong-market'; market: MarketCode }
  | { kind: 'error'; message: string };

/** Décision de rendu, dérivée à chaque render (jamais stockée). */
export type GuardDestination =
  | { kind: 'loading' }
  | { kind: 'ok' }
  | { kind: 'redirect'; path: string }
  | { kind: 'error'; message: string };

/**
 * FONCTION PURE : la destination ne dépend que de l'entrée courante, jamais
 * d'un état résiduel. C'est ce qui rend une boucle impossible par construction :
 *
 * - `outcome === null` → aucune décision périmée ne peut être rejouée ;
 * - invariant anti-boucle : on ne redirige JAMAIS vers l'URL courante.
 */
export function resolveDestination({
  outcome,
  wrongRolePath,
  wrongMarketPath = (market) => `/${market.toLowerCase()}/gerant`,
  currentPath,
}: {
  outcome: GuardOutcome | null;
  wrongRolePath: string;
  wrongMarketPath?: (market: MarketCode) => string;
  currentPath: string;
}): GuardDestination {
  if (!outcome) return { kind: 'loading' };

  switch (outcome.kind) {
    case 'ready':
      return { kind: 'ok' };
    case 'error':
      return { kind: 'error', message: outcome.message };
    case 'wrong-role':
      return wrongRolePath === currentPath
        ? { kind: 'error', message: 'Espace introuvable pour ce compte.' }
        : { kind: 'redirect', path: wrongRolePath };
    case 'wrong-market': {
      const path = wrongMarketPath(outcome.market);
      // Déjà sur le bon marché : rien à rediriger (sinon, boucle sur soi-même).
      return path === currentPath ? { kind: 'ok' } : { kind: 'redirect', path };
    }
  }
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
  const { pathname } = useLocation();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { signOut } = useClerk();
  const [retryToken, setRetryToken] = useState(0);
  const [attempt, setAttempt] = useState<{ identity: string; outcome: GuardOutcome } | null>(null);
  const [loopTripped, setLoopTripped] = useState(false);
  const countedPathname = useRef<string | null>(null);

  // Identité de la garde : tout changement (rôle, marché, réessai) invalide le
  // résultat précédent. Un 409 obtenu pour `/compte` ne peut donc jamais
  // influencer le rendu de `/gerant`, même quand React recycle l'instance.
  const identity = `${expectedRole}|${market ?? ''}|${retryToken}`;
  const outcome = attempt && attempt.identity === identity ? attempt.outcome : null;

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    const ensure = async (retryCount = 0) => {
      try {
        const marketCode = market?.toUpperCase();
        const result = await apiAuth.bootstrap({
          role: expectedRole,
          market: isMarketCode(marketCode) ? marketCode : 'CI',
        });
        if (cancelled) return;
        setAttempt({
          identity,
          outcome: result.role === expectedRole ? { kind: 'ready' } : { kind: 'wrong-role' },
        });
      } catch (err) {
        if (cancelled) return;
        // 409 avec un marché renvoyé : le compte (client ou gérant) est
        // rattaché à un autre marché que celui de l'URL → on redirige vers
        // l'espace correspondant du marché réel.
        if (err instanceof ApiError && err.status === 409) {
          const detail = err.detail as { market?: string } | undefined;
          const actualMarket = detail?.market;
          if (actualMarket && isMarketCode(actualMarket)) {
            setAttempt({ identity, outcome: { kind: 'wrong-market', market: actualMarket } });
            return;
          }
        }
        const errorMessage = err instanceof Error ? err.message : '';
        if (errorMessage.includes(expectedRole === 'client' ? 'gerant' : 'client')) {
          setAttempt({ identity, outcome: { kind: 'wrong-role' } });
          return;
        }
        if (isTransientError(err) && retryCount < 2) {
          await new Promise((r) => setTimeout(r, 800));
          if (!cancelled) await ensure(retryCount + 1);
          return;
        }
        setAttempt({
          identity,
          outcome: { kind: 'error', message: errorMessage || 'Impossible de vérifier votre compte.' },
        });
      }
    };

    ensure();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, expectedRole, market, retryToken, identity]);

  const dest = resolveDestination({
    outcome,
    wrongRolePath,
    wrongMarketPath: rolePaths[expectedRole].wrongMarket,
    currentPath: pathname,
  });
  const redirectPath = dest.kind === 'redirect' ? dest.path : null;

  // Disjoncteur : compte les redirections d'une même session. Dès qu'un espace
  // stable est atteint, le budget est remis à zéro. La déduplication par URL
  // évite qu'une double invocation d'effet (StrictMode) ne compte deux fois.
  useEffect(() => {
    if (loopTripped) return;
    if (dest.kind === 'ok') {
      resetAuthRedirectBudget();
      countedPathname.current = null;
      return;
    }
    if (!redirectPath) return;
    if (countedPathname.current === pathname) return;
    countedPathname.current = pathname;
    authRedirectBudget += 1;
    if (authRedirectBudget > MAX_AUTH_REDIRECTS) setLoopTripped(true);
  }, [dest.kind, redirectPath, pathname, loopTripped]);

  const handleRetry = () => {
    resetAuthRedirectBudget();
    countedPathname.current = null;
    setLoopTripped(false);
    setAttempt(null);
    setRetryToken((n) => n + 1);
  };

  const handleSignOut = () => {
    void signOut();
  };

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <Navigate to={loginPath} replace />;
  if (loopTripped) {
    return (
      <ErrorScreen
        message="Redirection en boucle détectée. Veuillez vous reconnecter."
        onRetry={handleRetry}
        onSignOut={handleSignOut}
      />
    );
  }
  if (dest.kind === 'loading') return <Loading />;
  if (dest.kind === 'ok') return <>{children}</>;
  if (dest.kind === 'error') {
    return <ErrorScreen message={dest.message} onRetry={handleRetry} onSignOut={handleSignOut} />;
  }

  return <Navigate to={dest.path} replace />;
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
