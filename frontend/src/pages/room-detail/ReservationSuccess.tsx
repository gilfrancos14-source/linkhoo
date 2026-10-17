import { Link } from 'react-router-dom';

interface ReservationSuccessProps {
  queued: boolean;
  clerkSignedIn: boolean;
  market: string;
  homePath: string;
}

export default function ReservationSuccess({
  queued,
  clerkSignedIn,
  market,
  homePath,
}: ReservationSuccessProps) {
  return (
    <div className="room-detail__success" role="status">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--sun)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
      {queued ? (
        <>
          <p>Votre demande a été enregistrée hors-ligne.</p>
          <p>Elle sera envoyée automatiquement dès le retour de la connexion.</p>
        </>
      ) : (
        <>
          <p>Votre demande a bien été envoyée !</p>
          <p>Nous vous recontacterons dans les plus brefs délais.</p>
          <Link to={clerkSignedIn ? `/${market.toLowerCase()}/compte` : `${homePath}/suivi-reservation`} className="room-detail__track-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            Suivre ma réservation
          </Link>
        </>
      )}
    </div>
  );
}
