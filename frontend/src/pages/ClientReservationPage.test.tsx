import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import ClientReservationPage from './ClientReservationPage';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  getToken: vi.fn<() => Promise<string | null>>(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
    getToken: mocks.getToken,
  }),
  useClerk: () => ({ signOut: mocks.signOut }),
  useUser: () => ({ user: null }),
  SignIn: () => <div data-testid="clerk-signin" />,
  SignUp: () => <div data-testid="clerk-signup" />,
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderSuivi(
  entry: string,
  Page: typeof ClientReservationPage = ClientReservationPage,
  Provider: typeof MarketProvider = MarketProvider,
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Provider>
        <LocationProbe />
        <Routes>
          <Route path="/:market/compte" element={<div>Mon compte</div>} />
          <Route path="/:market/login" element={<div>Page de connexion</div>} />
          <Route path="/:market" element={<div>Accueil du marché</div>} />
          <Route path="/:market/*" element={<Page />} />
        </Routes>
      </Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('ClientReservationPage', () => {
  it("affiche le titre et l'explication de sécurité", () => {
    renderSuivi('/ci/suivi-reservation');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Suivi de réservation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Pour des raisons de sécurité, connectez-vous pour consulter vos réservations.'),
    ).toBeInTheDocument();
  });

  it("propose un fil d'Ariane jusqu'à l'accueil du marché", () => {
    renderSuivi('/ci/suivi-reservation');

    const breadcrumb = screen.getByRole('navigation', { name: "Fil d'Ariane" });
    expect(breadcrumb).toBeInTheDocument();
    expect(within(breadcrumb).getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/ci');
    expect(within(breadcrumb).getByText('Suivi de réservation')).toHaveAttribute('aria-current', 'page');
  });

  it('invite à se connecter avec un lien vers la page de connexion du marché', () => {
    renderSuivi('/bj/suivi-reservation');

    const login = screen.getByRole('link', { name: 'Se connecter' });
    expect(login).toHaveAttribute('href', '/bj/login');
    expect(
      screen.getByText("Connectez-vous à votre espace pour voir l'état de vos demandes."),
    ).toBeInTheDocument();
  });

  it('propose de parcourir les appartements vers l’accueil du marché', () => {
    renderSuivi('/bj/suivi-reservation');

    const browse = screen.getByRole('link', { name: 'Parcourir les appartements' });
    expect(browse).toHaveAttribute('href', '/bj');
  });

  it('navigue vers la connexion au clic sur « Se connecter »', async () => {
    renderSuivi('/bj/suivi-reservation');

    await userEvent.click(screen.getByRole('link', { name: 'Se connecter' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/login');
    expect(screen.getByText('Page de connexion')).toBeInTheDocument();
  });

  it('reste sur la page quand l’utilisateur n’est pas connecté', () => {
    mocks.isSignedIn = false;

    renderSuivi('/ci/suivi-reservation');

    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/suivi-reservation');
    expect(screen.getByRole('heading', { level: 1, name: 'Suivi de réservation' })).toBeInTheDocument();
  });

  it('reste sur la page tant que Clerk n’a pas chargé', () => {
    mocks.isLoaded = false;
    mocks.isSignedIn = true;

    renderSuivi('/ci/suivi-reservation');

    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/suivi-reservation');
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('redirige un utilisateur connecté vers son espace compte', () => {
    mocks.isLoaded = true;
    mocks.isSignedIn = true;

    renderSuivi('/bj/suivi-reservation');

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/compte');
    expect(screen.getByText('Mon compte')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Suivi de réservation' }),
    ).not.toBeInTheDocument();
  });

  // `clerkConfigured` est lu au chargement du module : il faut un module neuf
  // (resetModules + import dynamique) — MarketProvider doit suivre, sinon le
  // contexte de marché n'est plus le même que celui du module fraîchement importé.
  it('n’affiche jamais la redirection quand la clé Clerk est absente', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    mocks.isLoaded = true;
    mocks.isSignedIn = true;

    const [page, ctx] = await Promise.all([
      import('./ClientReservationPage'),
      import('../contexts/MarketContext'),
    ]);
    renderSuivi('/ci/suivi-reservation', page.default, ctx.MarketProvider);

    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/suivi-reservation');
    expect(screen.queryByText('Mon compte')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Suivi de réservation' }),
    ).toBeInTheDocument();
  });
});
