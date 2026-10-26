import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiGerants,
  type GerantData,
  type VerificationDocument,
  type VerificationStatusResponse,
} from '../../../lib/api';

/**
 * Document tel que renvoyé par `GET /gerants/:id/verification-status` :
 * le backend ne sélectionne que ces colonnes, on ne promet donc pas plus.
 */
export type SuiviDocument = Pick<
  VerificationDocument,
  'id' | 'document_type' | 'status' | 'rejection_reason'
>;

export type VerificationStatusValue = GerantData['verification_status'];

export interface SuiviVerification {
  gerant: GerantData | null;
  status: VerificationStatusResponse | null;
  documents: SuiviDocument[];
  loading: boolean;
  error: string;
  reload: () => void;
}

/** Le statut peut changer côté administration : on le rafraîchit doucement. */
const POLL_MS = 30_000;

/**
 * Dossier de vérification du gérant connecté.
 *
 * Source unique de vérité de la page de suivi : profil, statut et documents
 * viennent de l'API (Clerk + Supabase), jamais de valeurs codées en dur.
 * Le rechargement périodique est silencieux (pas de spinner plein écran) et
 * s'interrompt quand l'onglet est masqué.
 */
export function useSuiviVerification(): SuiviVerification {
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const aliveRef = useRef(true);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const me = await apiGerants.getMe();
      if (!aliveRef.current) return;

      const verification = await apiGerants.getVerificationStatus(me.id);
      if (!aliveRef.current) return;

      setGerant(me);
      setStatus(verification);
      setError('');
    } catch (err) {
      if (!aliveRef.current || silent) return;
      setError(
        err instanceof Error ? err.message : 'Impossible de charger votre dossier de vérification.',
      );
    } finally {
      if (aliveRef.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void load(false);
    return () => {
      aliveRef.current = false;
    };
  }, [load, reloadKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    gerant,
    status,
    documents: status?.documents ?? [],
    loading,
    error,
    reload,
  };
}
