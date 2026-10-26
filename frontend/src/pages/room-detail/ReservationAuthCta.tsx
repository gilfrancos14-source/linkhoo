import { Link } from 'react-router-dom';

interface ReservationAuthCtaProps {
  market: string;
}

export default function ReservationAuthCta({ market }: ReservationAuthCtaProps) {
  return (
    <div className="room-detail__auth-cta">
      <div className="room-detail__auth-hint">
        <span className="room-detail__auth-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </span>
        <p>Connectez-vous pour pré-remplir vos infos et suivre facilement vos réservations.</p>
      </div>
      <div className="room-detail__auth-box">
        <p className="room-detail__auth-title">Vous n’êtes pas connecté ?</p>
        <div className="room-detail__auth-cta-actions">
          <Link to={`/${market.toLowerCase()}/login`} className="room-detail__auth-btn room-detail__auth-btn--primary">
            Se connecter
          </Link>
          <Link to={`/${market.toLowerCase()}/inscription`} className="room-detail__auth-btn">
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
