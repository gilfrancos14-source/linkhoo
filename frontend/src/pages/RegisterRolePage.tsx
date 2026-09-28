import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SignUp, useAuth } from '@clerk/clerk-react';
import { apiAuth, setAuthTokenGetter, type AuthRole } from '../lib/api';

type Role = AuthRole;

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkKey && clerkKey.startsWith('pk_'));

export default function RegisterRolePage() {
  const { market } = useParams<{ market: string }>();
  const currentMarket = (market ?? 'ci').toLowerCase();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const role: Role = useMemo(
    () => (location.pathname.includes('/gerant') ? 'gerant' : 'client'),
    [location.pathname],
  );

  const redirectUrl = `/${currentMarket}`;

  const clerkPath = role === 'client'
    ? `/${currentMarket}/inscription/client`
    : `/${currentMarket}/inscription/gerant`;

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!clerkConfigured || !isLoaded || !isSignedIn) return;

    let cancelled = false;

    const run = async () => {
      try {
        await apiAuth.bootstrap({
          role,
          market: currentMarket === 'bj' ? 'BJ' : 'CI',
        });
      } catch {
        // le guard de destination retentera / affichera l'erreur
      }
      if (!cancelled) {
        navigate(redirectUrl, { replace: true });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clerkConfigured, isLoaded, isSignedIn, role, redirectUrl, currentMarket, navigate]);

  useEffect(() => {
    const bare = `/${currentMarket}/inscription`;
    if (window.location.pathname === bare) {
      navigate(`${bare}/client`, { replace: true });
    }
  }, [currentMarket, navigate]);

  const selectRole = (next: Role) => {
    if (next === role) return;
    navigate(
      next === 'client'
        ? `/${currentMarket}/inscription/client`
        : `/${currentMarket}/inscription/gerant`,
      { replace: true },
    );
  };

  if (!clerkConfigured) {
    return (
      <main className="auth-loading">
        <div className="auth-loading__spinner" />
        <p>Clé Clerk manquante dans frontend/.env</p>
      </main>
    );
  }

  const benefits = role === 'client'
    ? [
        { icon: 'search', title: 'Trouvez votre hébergement', text: 'Parcourez des chambres soigneusement sélectionnées près de chez vous.' },
        { icon: 'calendar', title: 'Réservez en quelques clics', text: 'Disponibilités en temps réel et confirmation immédiate de votre réservation.' },
        { icon: 'star', title: 'Laissez votre avis', text: 'Après un séjour confirmé, notez l’appartement et le gérant.' },
        { icon: 'user', title: 'Suivez vos réservations', text: 'Retrouvez l’historique et le statut de chaque réservation dans votre espace.' },
      ]
    : [
        { icon: 'home', title: 'Publiez vos annonces', text: 'Mettez en ligne vos chambres et appartements avec photos et tarifs.' },
        { icon: 'calendar', title: 'Gérez les réservations', text: 'Validez, confirmez ou annulez les demandes depuis un tableau de bord clair.' },
        { icon: 'star', title: 'Recevez des avis', text: 'Les clients confirmés notent votre bien et votre accueil.' },
        { icon: 'trending', title: 'Développez votre activité', text: 'Suivez votre performance et rendez vos biens plus visibles.' },
      ];

  return (
    <main className="register-page">
      <div className="register-page__inner">
        <aside className="register-page__info">
          <h1 className="register-page__title">
            {role === 'client'
              ? 'Votre espace client vous attend'
              : 'Rejoignez les gérants Linkhoo'}
          </h1>
          <p className="register-page__subtitle">
            {role === 'client'
              ? 'Créez votre compte pour réserver, suivre vos séjours et partager votre expérience.'
              : 'Créez votre compte gérant pour publier vos biens et gérer vos réservations.'}
          </p>

          <div className="register-page__roles" role="tablist" aria-label="Choisir mon rôle">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'client'}
              className={`register-page__role${role === 'client' ? ' is-active' : ''}`}
              onClick={() => selectRole('client')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Je suis client
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'gerant'}
              className={`register-page__role${role === 'gerant' ? ' is-active' : ''}`}
              onClick={() => selectRole('gerant')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 21h18" />
                <path d="M5 21V7l7-4 7 4v14" />
                <path d="M9 21v-6h6v6" />
              </svg>
              Je suis gérant
            </button>
          </div>

          <ul className="register-page__benefits">
            {benefits.map((b) => (
              <li key={b.title} className="register-page__benefit">
                <span className="register-page__benefit-icon" aria-hidden="true">
                  {b.icon === 'search' && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  )}
                  {b.icon === 'calendar' && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
                  )}
                  {b.icon === 'star' && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.8 6.6 19.8l1-6.1L3.2 9.4l6.1-.9L12 3z" /></svg>
                  )}
                  {b.icon === 'user' && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  )}
                  {b.icon === 'home' && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10z" /></svg>
                  )}
                  {b.icon === 'trending' && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" /></svg>
                  )}
                </span>
                <div>
                  <strong>{b.title}</strong>
                  <p>{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="register-page__form-side" aria-label="Formulaire d'inscription">
          <div className="register-page__form">
            <SignUp
              key={clerkPath}
              routing="path"
              path={clerkPath}
              signInUrl={`/${currentMarket}/login`}
              fallbackRedirectUrl={clerkPath}
              unsafeMetadata={{ role }}
              appearance={{
                variables: {
                  colorBackground: 'transparent',
                  colorPrimary: '#1e293b',
                  colorText: '#0f172a',
                  colorTextSecondary: '#64748b',
                },
                elements: {
                  card: 'none',
                  rootBox: 'width: 100%; background: transparent;',
                  cardBox: 'box-shadow: none; border: none; background: transparent; padding: 0; margin: 0;',
                },
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
