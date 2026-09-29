import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GerantLogin from './GerantLogin';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}));

vi.mock('@clerk/clerk-react', async () => {
  const React = await import('react');
  return {
    useAuth: () => ({
      isLoaded: mocks.isLoaded,
      isSignedIn: mocks.isSignedIn,
    }),
    // On capture les props Clerk pour asserter la construction des URLs
    // de marché sans dépendre du rendu réel du composant propriétaire.
    SignIn: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-testid': 'clerk-sign-in',
        'data-path': String(props.path),
        'data-signup': String(props.signUpUrl),
        'data-fallback': String(props.fallbackRedirectUrl),
        'data-routing': String(props.routing),
      }),
  };
});

function renderLogin(entry = '/ci/login/gerant', page = <GerantLogin />) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/ci/login/gerant" element={page} />
        <Route path="/bj/login/gerant" element={page} />
        <Route path="/ci/gerant" element={<p>Tableau de bord CI</p>} />
        <Route path="/bj/gerant" element={<p>Tableau de bord BJ</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function signInCard() {
  const card = screen.getByTestId('clerk-sign-in');
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('GerantLogin', () => {
  it('présente le titre, le sous-titre et la zone de formulaire Clerk', () => {
    renderLogin();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Espace gérants' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connectez-vous pour gérer vos biens, vos réservations et votre activité.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Formulaire de connexion gérant' }),
    ).toBeInTheDocument();
  });

  it('liste les trois bénéfices destinés aux gérants', () => {
    renderLogin();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Gérez vos annonces')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Publiez et mettez à jour vos chambres et appartements facilement.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Traitez les réservations')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Validez, confirmez ou annulez les demandes depuis votre tableau de bord.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Suivez votre activité')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consultez vos performances et recevez les avis de vos clients.',
      ),
    ).toBeInTheDocument();
  });

  it('branche le composant Clerk SignIn sur les routes du marché CI', () => {
    renderLogin('/ci/login/gerant');

    const card = signInCard();
    expect(card).toHaveAttribute('data-routing', 'path');
    expect(card).toHaveAttribute('data-path', '/ci/login/gerant');
    expect(card).toHaveAttribute('data-signup', '/ci/inscription/gerant');
    expect(card).toHaveAttribute('data-fallback', '/ci/gerant');
  });

  it('reconstruit toutes les URLs Clerk depuis le segment /bj', () => {
    renderLogin('/bj/login/gerant');

    const card = signInCard();
    expect(card).toHaveAttribute('data-path', '/bj/login/gerant');
    expect(card).toHaveAttribute('data-signup', '/bj/inscription/gerant');
    expect(card).toHaveAttribute('data-fallback', '/bj/gerant');
  });

  it('redirige vers /ci/gerant quand l’utilisateur est déjà connecté', async () => {
    mocks.isLoaded = true;
    mocks.isSignedIn = true;

    renderLogin('/ci/login/gerant');

    expect(await screen.findByText('Tableau de bord CI')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('déduit la destination du marché de l’URL pour un connecté sur /bj', async () => {
    mocks.isLoaded = true;
    mocks.isSignedIn = true;

    renderLogin('/bj/login/gerant');

    expect(await screen.findByText('Tableau de bord BJ')).toBeInTheDocument();
  });

  it('reste sur le formulaire tant que Clerk n’a pas chargé', () => {
    mocks.isLoaded = false;
    mocks.isSignedIn = true;

    renderLogin('/ci/login/gerant');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Espace gérants' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord CI')).not.toBeInTheDocument();
  });

  it('affiche le formulaire pour un visiteur non connecté', () => {
    mocks.isLoaded = true;
    mocks.isSignedIn = false;

    renderLogin('/ci/login/gerant');

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord CI')).not.toBeInTheDocument();
  });

  it('signale la clé Clerk absente même pour un utilisateur connecté', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    const fresh = await import('./GerantLogin');
    mocks.isLoaded = true;
    mocks.isSignedIn = true;

    render(
      <MemoryRouter initialEntries={['/ci/login/gerant']}>
        <Routes>
          <Route path="/ci/login/gerant" element={<fresh.default />} />
          <Route path="/ci/gerant" element={<p>Tableau de bord CI</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Clé Clerk manquante dans frontend/.env'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Espace gérants' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord CI')).not.toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });
});
