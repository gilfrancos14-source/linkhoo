import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ClientLogin from './ClientLogin';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  getToken: vi.fn<() => Promise<string | null>>(),
  signOut: vi.fn<() => Promise<void>>(),
}));

interface SignInProps {
  routing?: string;
  path?: string;
  signUpUrl?: string;
  fallbackRedirectUrl?: string;
}

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
    getToken: mocks.getToken,
  }),
  useClerk: () => ({ signOut: mocks.signOut }),
  useUser: () => ({ user: null }),
  SignIn: (props: SignInProps) => (
    <div
      data-testid="clerk-signin"
      data-routing={props.routing}
      data-path={props.path}
      data-signup={props.signUpUrl}
      data-redirect={props.fallbackRedirectUrl}
    />
  ),
  SignUp: () => <div data-testid="clerk-signup" />,
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderLogin(entry: string, Page: typeof ClientLogin = ClientLogin) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/:market/compte" element={<div>Mon compte</div>} />
        <Route path="/:market/login/*" element={<Page />} />
        <Route path="/login/*" element={<Page />} />
      </Routes>
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

describe('ClientLogin', () => {
  it("affiche le titre d'accueil et le sous-titre de connexion", () => {
    renderLogin('/ci/login');

    expect(screen.getByRole('heading', { level: 1, name: 'Heureux de vous revoir' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connectez-vous pour retrouver votre espace client, vos réservations et vos avis.',
      ),
    ).toBeInTheDocument();
  });

  it('présente les trois bénéfices de l’espace client', () => {
    renderLogin('/ci/login');

    expect(screen.getByText('Retrouvez votre espace')).toBeInTheDocument();
    expect(screen.getByText('Suivez vos séjours')).toBeInTheDocument();
    expect(screen.getByText('Partagez votre expérience')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it("étiquette la zone du formulaire pour les lecteurs d'écran", () => {
    renderLogin('/ci/login');

    const formSide = screen.getByRole('region', { name: 'Formulaire de connexion' });
    expect(within(formSide).getByTestId('clerk-signin')).toBeInTheDocument();
  });

  it('configure Clerk avec les URLs du marché courant', () => {
    renderLogin('/bj/login');

    const signIn = screen.getByTestId('clerk-signin');
    expect(signIn).toHaveAttribute('data-routing', 'path');
    expect(signIn).toHaveAttribute('data-path', '/bj/login');
    expect(signIn).toHaveAttribute('data-signup', '/bj/inscription');
    expect(signIn).toHaveAttribute('data-redirect', '/bj/compte');
  });

  it("retombe sur le marché ci quand l'URL ne porte pas de segment de marché", () => {
    renderLogin('/login');

    const signIn = screen.getByTestId('clerk-signin');
    expect(signIn).toHaveAttribute('data-path', '/ci/login');
    expect(signIn).toHaveAttribute('data-redirect', '/ci/compte');
  });

  it('redirige un utilisateur déjà connecté vers son espace compte', () => {
    mocks.isLoaded = true;
    mocks.isSignedIn = true;

    renderLogin('/bj/login');

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/compte');
    expect(screen.getByText('Mon compte')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-signin')).not.toBeInTheDocument();
  });

  it('affiche le formulaire tant que Clerk n’a pas terminé son chargement', () => {
    mocks.isLoaded = false;
    mocks.isSignedIn = true;

    renderLogin('/ci/login');

    expect(screen.getByTestId('clerk-signin')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/login');
  });

  // `clerkConfigured` est figé au chargement du module : resetModules + import
  // dynamique pour obtenir une page qui ne voit pas la clé du .env de test.
  it("signale l'absence de clé Clerk plutôt que d'afficher le formulaire", async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();

    const mod = await import('./ClientLogin');
    renderLogin('/ci/login', mod.default);

    expect(screen.getByText('Clé Clerk manquante dans frontend/.env')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-signin')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Heureux de vous revoir' })).toBeNull();
  });
});
