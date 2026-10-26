import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

const STEPS = [
  { title: 'Connectez-vous', text: "Accédez à votre espace client en un clic." },
  { title: 'Consultez vos demandes', text: "Suivez l'état de chaque réservation en temps réel." },
  { title: 'Échangez', text: 'Discutez directement avec le gérant depuis la messagerie.' },
];

export default function ClientReservationPage() {
  const homePath = useHomePath();
  const { isLoaded, isSignedIn } = useAuth();

  const marketSeg = homePath.replace(/^\//, '');

  if (clerkConfigured && isLoaded && isSignedIn) {
    return <Navigate to={`/${marketSeg}/compte`} replace />;
  }

  return (
    <main className="client-reservation">
      <div className="container">
        <nav className="room-detail__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath}>Accueil</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Suivi de réservation</span>
        </nav>

        <div className="client-reservation__card">
          <div className="client-reservation__header">
            <span className="client-reservation__badge">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </span>
            <h1>Suivi de réservation</h1>
            <p>Pour des raisons de sécurité, connectez-vous pour consulter vos réservations.</p>
          </div>

          <div className="client-reservation__empty">
            <span className="client-reservation__empty-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </span>
            <p>Connectez-vous à votre espace pour voir l'état de vos demandes.</p>
          </div>

          <ul className="client-reservation__steps">
            {STEPS.map((step, index) => (
              <li className="client-reservation__step" key={step.title}>
                <span className="client-reservation__step-index" aria-hidden="true">{index + 1}</span>
                <span className="client-reservation__step-body">
                  <span className="client-reservation__step-title">{step.title}</span>
                  <span className="client-reservation__step-text">{step.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="client-reservation__footer">
            <Link to={`/${marketSeg}/login`} className="client-reservation__link client-reservation__link--primary">
              Se connecter
            </Link>
            <Link to={homePath} className="client-reservation__link">Parcourir les appartements</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
