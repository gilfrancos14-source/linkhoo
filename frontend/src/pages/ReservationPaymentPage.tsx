import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';
import { ApiError, type ReservationData } from '../lib/api';
import { confirmReservationPayment } from '../lib/reservations';
import { formatPrice } from '../lib/roomDisplay';

type Status = 'loading' | 'success' | 'pending' | 'error';

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Retour du checkout hébergé Hub2 pour une réservation.
 *
 * Le webhook est le chemin nominal : cette page ne fait que le doubler en
 * interrogeant Hub2 à partir de `?reference=PAY-…`. Elle est publique (la
 * réservation l'est aussi) et n'affiche aucune donnée personnelle.
 */
export default function ReservationPaymentPage() {
  const homePath = useHomePath();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const verify = useCallback(async () => {
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (!reference) {
      setStatus('error');
      setMessage('Référence de paiement manquante.');
      return;
    }

    try {
      const result = await confirmReservationPayment(reference);
      setReservation(result.reservation);
      setStatus('success');
      setMessage('Votre réservation est payée. Le gérant va la confirmer.');
    } catch (err) {
      const code = err instanceof ApiError
        ? (err.detail as { code?: string } | undefined)?.code
        : undefined;
      if (code === 'PAYMENT_NOT_SUCCEEDED') {
        setStatus('pending');
        setMessage(
          "Le paiement n'a pas encore été confirmé. Si vous venez de payer, réessayez dans quelques secondes.",
        );
        return;
      }
      setStatus('error');
      setMessage(
        err instanceof Error ? err.message : 'Erreur lors de la confirmation du paiement.',
      );
    }
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  const handleRecheck = async () => {
    setRechecking(true);
    await verify();
    setRechecking(false);
  };

  const tone =
    status === 'success'
      ? { bg: 'linear-gradient(120deg, #D1FAE5 0%, #A7F3D0 100%)', border: '#10B981', title: '#065F46', text: '#047857' }
      : status === 'error'
        ? { bg: 'linear-gradient(120deg, #FEE2E2 0%, #FECACA 100%)', border: '#EF4444', title: '#991B1B', text: '#B91C1C' }
        : { bg: undefined, border: undefined, title: '#92400E', text: '#A16207' };

  const heading =
    status === 'loading'
      ? 'Confirmation en cours...'
      : status === 'success'
        ? 'Paiement confirmé'
        : status === 'pending'
          ? 'Paiement en attente de confirmation'
          : 'Paiement non confirmé';

  return (
    <main className="client-reservation">
      <div className="container">
        <nav className="room-detail__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath}>Accueil</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Paiement de la réservation</span>
        </nav>

        <div className="client-reservation__card">
          <div className="client-reservation__header">
            <h1>Paiement de la réservation</h1>
            <p>Vérification du paiement auprès de notre prestataire.</p>
          </div>

          <section
            className="verify-cta"
            aria-live="polite"
            style={{ background: tone.bg, borderColor: tone.border }}
          >
            <div className="verify-cta__text">
              <h3 style={{ color: tone.title }}>{heading}</h3>
              <p style={{ color: tone.text }}>
                {status === 'loading' ? 'Vérification de votre paiement...' : message}
              </p>
            </div>
          </section>

          {status === 'success' && reservation && (
            <ul className="client-reservation__steps">
              <li className="client-reservation__step">
                <span className="client-reservation__step-body">
                  <span className="client-reservation__step-title">{reservation.room_title}</span>
                  <span className="client-reservation__step-text">
                    Du {formatDate(reservation.date_debut)} au {formatDate(reservation.date_fin)}
                  </span>
                </span>
              </li>
              <li className="client-reservation__step">
                <span className="client-reservation__step-body">
                  <span className="client-reservation__step-title">
                    {formatPrice(reservation.montant)} FCFA
                  </span>
                  <span className="client-reservation__step-text">Montant réglé</span>
                </span>
              </li>
            </ul>
          )}

          <div className="client-reservation__footer">
            {(status === 'pending' || status === 'error') && (
              <button
                type="button"
                className="client-reservation__link client-reservation__link--primary"
                onClick={handleRecheck}
                disabled={rechecking}
              >
                {rechecking ? 'Vérification...' : 'Revérifier le paiement'}
              </button>
            )}
            <Link to={`${homePath}/compte`} className="client-reservation__link">
              Voir mes réservations
            </Link>
            <Link to={homePath} className="client-reservation__link">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
