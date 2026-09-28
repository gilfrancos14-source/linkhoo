import { SignIn, useAuth } from '@clerk/clerk-react';
import { useParams, Navigate } from 'react-router-dom';
import SplitAuthLayout, {
  clerkFormAppearance,
  type AuthBenefit,
} from '../components/SplitAuthLayout';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

const benefits: AuthBenefit[] = [
  {
    icon: 'user',
    title: 'Retrouvez votre espace',
    text: 'Accédez à vos réservations, avis et informations personnelles en un clic.',
  },
  {
    icon: 'calendar',
    title: 'Suivez vos séjours',
    text: 'Consultez l’historique et le statut de chaque réservation en temps réel.',
  },
  {
    icon: 'star',
    title: 'Partagez votre expérience',
    text: 'Après un séjour confirmé, notez l’appartement et le gérant.',
  },
];

export default function ClientLogin() {
  const { market } = useParams<{ market: string }>();
  const currentMarket = (market ?? 'ci').toLowerCase();
  const { isLoaded, isSignedIn } = useAuth();

  if (!clerkConfigured) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
        <p>Clé Clerk manquante dans frontend/.env</p>
      </div>
    );
  }

  if (isLoaded && isSignedIn) {
    return <Navigate to={`/${currentMarket}/compte`} replace />;
  }

  return (
    <SplitAuthLayout
      title="Heureux de vous revoir"
      subtitle="Connectez-vous pour retrouver votre espace client, vos réservations et vos avis."
      benefits={benefits}
      formLabel="Formulaire de connexion"
    >
      <SignIn
        routing="path"
        path={`/${currentMarket}/login`}
        signUpUrl={`/${currentMarket}/inscription`}
        fallbackRedirectUrl={`/${currentMarket}/compte`}
        appearance={clerkFormAppearance}
      />
    </SplitAuthLayout>
  );
}
