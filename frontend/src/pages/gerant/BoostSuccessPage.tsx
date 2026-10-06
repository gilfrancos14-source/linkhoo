import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../../hooks/useHomePath';
import { apiBoosts } from '../../lib/api';

// Le webhook peut arriver après le retour du gérant : on relance quelques
// fois la confirmation avant d'afficher une erreur, sans jamais bloquer la page.
const RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 3;

const PENDING_RE = /en attente|pending|non confirm|pas pay|declined|canceled/i;

export default function BoostSuccessPage() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const { userId, isLoaded } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setStatus('error');
      setMessage(
        'Vous devez être connecté pour confirmer votre paiement. Connectez-vous puis revenez sur cette page.',
      );
      return;
    }

    let cancelled = false;

    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const transactionId = idParam ? parseInt(idParam, 10) : NaN;

    if (!idParam || !Number.isFinite(transactionId)) {
      setStatus('error');
      setMessage('Paramètres de paiement invalides.');
      return;
    }

    setStatus('loading');
    setMessage('');

    (async () => {
      try {
        await apiBoosts.confirm(transactionId);
        if (cancelled) return;
        setStatus('success');
        setMessage('Votre campagne est maintenant active !');
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error && err.message ? err.message : 'Erreur lors de la confirmation du paiement.';
        if (PENDING_RE.test(raw) && attempt < MAX_AUTO_RETRIES) {
          // Toujours en attente : nouvelle tentative dans 3 s, page en chargement.
          retryTimer.current = setTimeout(() => setAttempt((value) => value + 1), RETRY_DELAY_MS);
          setMessage("Paiement en attente de confirmation — nouvelle tentative...");
          return;
        }
        setStatus('error');
        setMessage(
          PENDING_RE.test(raw)
            ? "Le paiement n'a pas encore été confirmé. Si vous venez de payer, réessayez dans quelques secondes."
            : raw,
        );
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [isLoaded, userId, attempt]);

  const handleRecheck = () => setAttempt((value) => value + 1);

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Booster</h1>
      </div>

      <section
        className="verify-cta"
        style={{
          background:
            status === 'success'
              ? 'linear-gradient(120deg, #D1FAE5 0%, #A7F3D0 100%)'
              : status === 'error'
                ? 'linear-gradient(120deg, #FEE2E2 0%, #FECACA 100%)'
                : undefined,
          borderColor: status === 'success' ? '#10B981' : status === 'error' ? '#EF4444' : undefined,
        }}
      >
        <div
          className="verify-cta__icon"
          style={{
            background:
              status === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : status === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : undefined,
            color: status === 'success' ? '#059669' : status === 'error' ? '#DC2626' : undefined,
          }}
        >
          {status === 'loading' ? (
            <div
              style={{
                width: 24,
                height: 24,
                border: '3px solid #D97706',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          ) : status === 'success' ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>
        <div className="verify-cta__text">
          <h3 style={{ color: status === 'success' ? '#065F46' : status === 'error' ? '#991B1B' : '#92400E' }}>
            {status === 'loading'
              ? 'Confirmation en cours...'
              : status === 'success'
                ? 'Paiement confirmé'
                : 'Erreur'}
          </h3>
          <p style={{ color: status === 'success' ? '#047857' : status === 'error' ? '#B91C1C' : '#A16207' }}>
            {status === 'loading'
              ? message || 'Vérification de votre paiement avec FedaPay...'
              : message}
          </p>
        </div>
      </section>

      {status === 'error' && userId && (
        <button
          onClick={handleRecheck}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '20px',
            marginRight: '12px',
            padding: '10px 20px',
            background: '#fff',
            color: '#D97706',
            border: '1px solid #D97706',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Revérifier le paiement
        </button>
      )}

      {status === 'success' && (
        <Link
          to={`${gerantPath}/boosts`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '20px',
            marginRight: '12px',
            padding: '10px 20px',
            background: '#4F46E5',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Voir mes campagnes
        </Link>
      )}

      {status !== 'loading' && (
        <Link
          to={`${gerantPath}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '20px',
            padding: '10px 20px',
            background: '#D97706',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Retour au tableau de bord
        </Link>
      )}
    </div>
  );
}
