import { Link } from 'react-router-dom';

interface ReservationAuthCtaProps {
  market: string;
}

export default function ReservationAuthCta({ market }: ReservationAuthCtaProps) {
  return (
    <div className="room-detail__auth-cta">
      <p>Connectez-vous pour pré-remplir vos infos et suivre facilement vos réservations.</p>
      <div className="room-detail__auth-cta-actions">
        <Link to={`/${market.toLowerCase()}/login`} className="room-detail__auth-btn room-detail__auth-btn--primary">
          Se connecter
        </Link>
        <Link to={`/${market.toLowerCase()}/inscription`} className="room-detail__auth-btn">
          Créer un compte
        </Link>
      </div>
    </div>
  );
}
