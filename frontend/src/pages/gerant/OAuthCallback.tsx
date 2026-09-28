import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { marketSlugFromPath } from '../../contexts/MarketContext';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = clerkKey && clerkKey.startsWith('pk_');

export default function OAuthCallback() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { handleRedirectCallback } = useClerk();

  // Hors /ci|/bj (market indéfini), on retombe sur /ci : le chemin doit
  // toujours être valide, sinon on navigue vers « /undefined/gerant ».
  const marketSlug = marketSlugFromPath(pathname) ?? 'ci';

  useEffect(() => {
    if (!clerkConfigured) {
      navigate(`/${marketSlug}/login/gerant`, { replace: true });
      return;
    }

    handleRedirectCallback({
      signInFallbackRedirectUrl: `/${marketSlug}/gerant`,
      signUpFallbackRedirectUrl: `/${marketSlug}/gerant`,
    })
      .then(() => {
        navigate(`/${marketSlug}/gerant`, { replace: true });
      })
      .catch(() => {
        navigate(`/${marketSlug}/login/gerant`, { replace: true });
      });
  }, [handleRedirectCallback, marketSlug, navigate]);

  return (
    <div className="auth-loading">
      <div className="auth-loading__spinner" />
      <p>Connexion en cours...</p>
    </div>
  );
}
