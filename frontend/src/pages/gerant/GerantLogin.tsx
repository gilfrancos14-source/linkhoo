import { SignIn, useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { marketSlugFromPath } from '../../contexts/MarketContext';
import SplitAuthLayout, {
  clerkFormAppearance,
  type AuthBenefit,
} from '../../components/SplitAuthLayout';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

const benefits: AuthBenefit[] = [
  {
    icon: 'home',
    title: 'Gérez vos annonces',
    text: 'Publiez et mettez à jour vos chambres et appartements facilement.',
  },
  {
    icon: 'calendar',
    title: 'Traitez les réservations',
    text: 'Validez, confirmez ou annulez les demandes depuis votre tableau de bord.',
  },
  {
    icon: 'trending',
    title: 'Suivez votre activité',
    text: 'Consultez vos performances et recevez les avis de vos clients.',
  },
];

export default function GerantLogin() {
  const { pathname } = useLocation();
  // Dérivé de l'URL (cf. MarketContext) plutôt que de useParams(), dont le
  // résultat dépend de la propagation des params dans les <Routes> imbriqués.
  const currentMarket = marketSlugFromPath(pathname) ?? 'ci';
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
    return <Navigate to={`/${currentMarket}/gerant`} replace />;
  }

  return (
    <SplitAuthLayout
      title="Espace gérants"
      subtitle="Connectez-vous pour gérer vos biens, vos réservations et votre activité."
      benefits={benefits}
      formLabel="Formulaire de connexion gérant"
    >
      <SignIn
        routing="path"
        path={`/${currentMarket}/login/gerant`}
        signUpUrl={`/${currentMarket}/inscription/gerant`}
        fallbackRedirectUrl={`/${currentMarket}/gerant`}
        appearance={clerkFormAppearance}
      />
    </SplitAuthLayout>
  );
}
