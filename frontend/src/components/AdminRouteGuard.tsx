import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  apiAdmin,
  AdminUnauthorizedError,
  ADMIN_UNAUTHORIZED_EVENT,
  type AdminData,
} from '../lib/adminApi';
import { marketSlugFromPath } from '../contexts/MarketContext';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Délai maximal pour vérifier la session admin. Au-delà, on affiche l'écran
 * « Réessayer » plutôt qu'un chargement infini (le back-office doit toujours
 * réagir, même sur un réseau lent ou coupé).
 */
const SESSION_CHECK_TIMEOUT_MS = 8_000;

/** Pause avant de retenter la vérification de session. */
const SESSION_RETRY_DELAY_MS = 1_500;

/** Nombre total de tentatives (1 essai + 1 repli) avant l'écran « Réessayer ». */
const MAX_SESSION_ATTEMPTS = 2;

function useAdmin(attempt: number) {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // F4 : le cookie HttpOnly n'est pas lisible par le JS ; la seule façon de
    // savoir si la session est valide est d'interroger /admin/me. Un 401 émet
    // ADMIN_UNAUTHORIZED_EVENT → redirection vers le login.
    setLoading(true);
    setNetworkError(false);

    const check = async (round: number): Promise<void> => {
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
      // Filet de sécurité : si l'appel n'aboutit jamais (réseau figé, proxy en
      // attente), on ne laisse pas le spinner tourner indéfiniment.
      const deadline = new Promise<never>((_, reject) => {
        deadlineTimer = setTimeout(
          () => reject(new Error('Délai dépassé.')),
          SESSION_CHECK_TIMEOUT_MS,
        );
      });

      try {
        const data = await Promise.race([apiAdmin.getMe(), deadline]);
        if (cancelled) return;
        setAdmin(data);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof AdminUnauthorizedError) {
          setAdmin(null);
          setLoading(false);
          return;
        }
        if (round < MAX_SESSION_ATTEMPTS) {
          // Coupure brève (réseau qui rame) : on retente une fois avant de
          // proposer un retry manuel, pour ne pas sortir l'admin de sa session
          // sur un incident de quelques secondes.
          retryTimer = setTimeout(() => {
            void check(round + 1);
          }, SESSION_RETRY_DELAY_MS);
          return;
        }
        // Erreur réseau/timeout : on ne déconnecte PAS, on montre un retry
        // (sinon F5 sur coupure 3 s = perte de session + URL profonde).
        setNetworkError(true);
        setLoading(false);
      } finally {
        if (deadlineTimer) clearTimeout(deadlineTimer);
      }
    };

    void check(1);

    const onUnauthorized = () => {
      setAdmin(null);
      setNetworkError(false);
      setLoading(false);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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
