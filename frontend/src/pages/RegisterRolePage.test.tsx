import type { MarketCode } from '../config/markets';

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import RegisterRolePage from './RegisterRolePage';

type AuthRole = 'client' | 'gerant';

interface BootstrapResult {
  role: AuthRole | null;
  profile_role: AuthRole | null;
  clerk_role: AuthRole | null;
}

interface SignUpProps {
  routing?: string;
  path?: string;
  signInUrl?: string;
  fallbackRedirectUrl?: string;
  unsafeMetadata?: { role?: string };
  appearance?: {
    variables?: { colorBackground?: string };
    elements?: { card?: string };
  };
}

// Tous les stubs jsdom et l'état des mocks sont posés AVANT l'évaluation des
// vi.mock : les factories de mock sont hoistées au-dessus des imports.
const mocks = vi.hoisted(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = (() => {}) as typeof Element.prototype.scrollIntoView;
  }
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  }
  if (!window.scrollTo) {
    window.scrollTo = (() => {}) as typeof window.scrollTo;
  }

  return {
    isLoaded: true,
    isSignedIn: false,
    getToken: vi.fn<() => Promise<string | null>>(),
    bootstrap: vi.fn<(args: { role: AuthRole; market?: MarketCode }) => Promise<BootstrapResult>>(),
    setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
    request: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    cachedGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
});

// Clerk est remplacé en entier : le vrai <SignUp> dépend d'un provider et
// d'un réseau qui n'existent pas dans jsdom.
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
    getToken: mocks.getToken,
  }),
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn<() => Promise<void>>() }),
  SignIn: () => <div data-testid="clerk-signin" />,
  SignUp: (props: SignUpProps) => (
    <div
      data-testid="clerk-signup"
      data-routing={props.routing}
      data-path={props.path}
      data-signin={props.signInUrl}
      data-redirect={props.fallbackRedirectUrl}
      data-role={props.unsafeMetadata?.role}
      data-card={props.appearance?.elements?.card}
      data-bg={props.appearance?.variables?.colorBackground}
    />
  ),
}));

// Couche réseau entièrement remplacée : aucun vrai fetch ne peut partir
// depuis ce fichier de test.
vi.mock('../lib/api', () => ({
  apiAuth: { bootstrap: mocks.bootstrap },
  setAuthTokenGetter: mocks.setAuthTokenGetter,
  request: mocks.request,
  cachedGet: mocks.cachedGet,
}));

/** Sonde d'URL : permet d'observer les navigate() de la page. */
function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

/** Sonde d'action : distingue une navigation replace d'une navigation push. */
function NavigationProbe() {
  const navigationType = useNavigationType();
  return <span data-testid="nav-type">{navigationType}</span>;
}

interface HostProps {
  entry: string;
  Page?: ComponentType;
  showPage?: boolean;
}

function Host({ entry, Page = RegisterRolePage, showPage = true }: HostProps) {
  const page = showPage ? (
    <Page />
  ) : (
    <div data-testid="page-placeholder">Page démontée</div>
  );
  return (
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <NavigationProbe />
      <Routes>
        <Route path="/:market/inscription" element={page} />
        <Route path="/:market/inscription/client/*" element={page} />
        <Route path="/:market/inscription/gerant/*" element={page} />
        <Route path="/inscription" element={page} />
        <Route path="/inscription/client/*" element={page} />
        <Route path="/inscription/gerant/*" element={page} />
        <Route path="/:market" element={<div data-testid="home">Accueil du marché</div>} />
        <Route path="/" element={<div data-testid="root-home">Accueil racine</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderPage(entry = '/ci/inscription/client', props: Omit<HostProps, 'entry'> = {}) {
  const view = render(<Host entry={entry} {...props} />);
  return {
    ...view,
    rerenderHost: (next: Omit<HostProps, 'entry'> = props) =>
      view.rerender(<Host entry={entry} {...next} />),
  };
}

function setupUser() {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
  mocks.getToken.mockResolvedValue('session-token');
  mocks.bootstrap.mockResolvedValue({ role: 'client', profile_role: null, clerk_role: null });
  mocks.request.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.cachedGet.mockRejectedValue(new Error('réseau interdit dans les tests'));
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
  // L'effet de redirection de la racine compare window.location.pathname :
  // on remet le document à zéro pour ne pas polluer le test suivant.
  window.history.replaceState({}, '', '/');
});

describe('RegisterRolePage — rendu initial', () => {
  it("affiche le titre et le sous-titre de l'espace client", () => {
    renderPage('/ci/inscription/client');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Votre espace client vous attend' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Créez votre compte pour réserver, suivre vos séjours et partager votre expérience.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it("expose un tablist étiqueté « Choisir mon rôle » avec deux onglets", () => {
    renderPage('/ci/inscription/client');

    const tablist = screen.getByRole('tablist', { name: 'Choisir mon rôle' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(2);
    expect(within(tablist).getByRole('tab', { name: 'Je suis client' })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Je suis gérant' })).toBeInTheDocument();
  });

  it("sélectionne l'onglet client et ne marque pas l'onglet gérant", () => {
    renderPage('/ci/inscription/client');

    const clientTab = screen.getByRole('tab', { name: 'Je suis client' });
    const gerantTab = screen.getByRole('tab', { name: 'Je suis gérant' });
    expect(clientTab).toHaveAttribute('aria-selected', 'true');
    expect(clientTab).toHaveClass('is-active');
    expect(gerantTab).toHaveAttribute('aria-selected', 'false');
    expect(gerantTab).not.toHaveClass('is-active');
  });

  it('liste les quatre bénéfices de l’espace client', () => {
    renderPage('/ci/inscription/client');

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Trouvez votre hébergement')).toBeInTheDocument();
    expect(screen.getByText('Réservez en quelques clics')).toBeInTheDocument();
    expect(screen.getByText('Laissez votre avis')).toBeInTheDocument();
    expect(screen.getByText('Suivez vos réservations')).toBeInTheDocument();
  });

  it('masque les icônes de bénéfices aux technologies d’assistance', () => {
    const { container } = renderPage('/ci/inscription/client');

    const icons = container.querySelectorAll('.register-page__benefit-icon');
    expect(icons).toHaveLength(4);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon.querySelector('svg')).not.toBeNull();
    });
  });

  it("étiquette la zone du formulaire pour les lecteurs d'écran", () => {
    renderPage('/ci/inscription/client');

    const region = screen.getByRole('region', { name: "Formulaire d'inscription" });
    expect(within(region).getByTestId('clerk-signup')).toBeInTheDocument();
  });

  it("n'affiche ni message d'erreur ni message de clé manquante", () => {
    renderPage('/ci/inscription/client');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Clé Clerk manquante/)).not.toBeInTheDocument();
  });
});

describe('RegisterRolePage — rôle piloté par l’URL', () => {
  it("affiche la page gérant sur /bj/inscription/gerant", () => {
    renderPage('/bj/inscription/gerant');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Rejoignez les gérants Linkhoo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Créez votre compte gérant pour publier vos biens et gérer vos réservations.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Je suis gérant' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Je suis client' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('liste les quatre bénéfices de l’espace gérant', () => {
    renderPage('/ci/inscription/gerant');

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Publiez vos annonces')).toBeInTheDocument();
    expect(screen.getByText('Gérez les réservations')).toBeInTheDocument();
    expect(screen.getByText('Recevez des avis')).toBeInTheDocument();
    expect(screen.getByText('Développez votre activité')).toBeInTheDocument();
    expect(screen.queryByText('Trouvez votre hébergement')).not.toBeInTheDocument();
  });

  it("retombe sur le marché ci quand l'URL ne porte pas de segment de marché", () => {
    renderPage('/inscription/client');

    const signup = screen.getByTestId('clerk-signup');
    expect(signup).toHaveAttribute('data-path', '/ci/inscription/client');
    expect(signup).toHaveAttribute('data-signin', '/ci/login');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/inscription/client');
  });

  it('normalise un marché saisi en majuscules', () => {
    renderPage('/CI/inscription/client');

    expect(screen.getByTestId('clerk-signup')).toHaveAttribute(
      'data-path',
      '/ci/inscription/client',
    );
  });
});

describe('RegisterRolePage — configuration Clerk', () => {
  it("configure Clerk sur le chemin d'inscription client du marché courant", () => {
    renderPage('/ci/inscription/client');

    const signup = screen.getByTestId('clerk-signup');
    expect(signup).toHaveAttribute('data-routing', 'path');
    expect(signup).toHaveAttribute('data-path', '/ci/inscription/client');
    expect(signup).toHaveAttribute('data-signin', '/ci/login');
    expect(signup).toHaveAttribute('data-redirect', '/ci/inscription/client');
    expect(signup).toHaveAttribute('data-role', 'client');
  });

  it("configure Clerk sur le chemin d'inscription gérant de bj", () => {
    renderPage('/bj/inscription/gerant');

    const signup = screen.getByTestId('clerk-signup');
    expect(signup).toHaveAttribute('data-routing', 'path');
    expect(signup).toHaveAttribute('data-path', '/bj/inscription/gerant');
    expect(signup).toHaveAttribute('data-signin', '/bj/login');
    expect(signup).toHaveAttribute('data-redirect', '/bj/inscription/gerant');
    expect(signup).toHaveAttribute('data-role', 'gerant');
  });

  it('aplatit le formulaire Clerk (carte sans bordure, fond transparent)', () => {
    renderPage('/ci/inscription/client');

    const signup = screen.getByTestId('clerk-signup');
    expect(signup).toHaveAttribute('data-card', 'none');
    expect(signup).toHaveAttribute('data-bg', 'transparent');
  });
});

describe('RegisterRolePage — sélection du rôle', () => {
  it("« Je suis gérant » remplace l'URL par /ci/inscription/gerant", async () => {
    renderPage('/ci/inscription/client');
    const user = setupUser();

    await user.click(screen.getByRole('tab', { name: 'Je suis gérant' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Rejoignez les gérants Linkhoo' })).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/gerant');
    expect(screen.getByTestId('nav-type')).toHaveTextContent('REPLACE');
    expect(screen.getByRole('tab', { name: 'Je suis gérant' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it("« Je suis client » ramène vers /ci/inscription/client", async () => {
    renderPage('/ci/inscription/gerant');
    const user = setupUser();

    await user.click(screen.getByRole('tab', { name: 'Je suis client' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Votre espace client vous attend' })).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client');
    expect(screen.getByTestId('nav-type')).toHaveTextContent('REPLACE');
  });

  it("cliquer l'onglet déjà actif ne déclenche aucune navigation", async () => {
    renderPage('/ci/inscription/client');
    const user = setupUser();
    const signupBefore = screen.getByTestId('clerk-signup');

    await user.click(screen.getByRole('tab', { name: 'Je suis client' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client');
    expect(screen.getByTestId('nav-type')).toHaveTextContent('POP');
    expect(screen.getByTestId('clerk-signup')).toBe(signupBefore);
  });

  it('remonte le formulaire Clerk quand le rôle change', async () => {
    renderPage('/ci/inscription/client');
    const user = setupUser();
    const signupBefore = screen.getByTestId('clerk-signup');

    await user.click(screen.getByRole('tab', { name: 'Je suis gérant' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Rejoignez les gérants Linkhoo' })).toBeInTheDocument();
    expect(screen.getByTestId('clerk-signup')).not.toBe(signupBefore);
  });
});

describe('RegisterRolePage — jeton Clerk', () => {
  it('enregistre getToken comme getter de jeton d’autorisation', () => {
    renderPage('/ci/inscription/client');

    expect(mocks.setAuthTokenGetter).toHaveBeenCalledTimes(1);
    const getter = mocks.setAuthTokenGetter.mock.calls[0]?.[0];
    if (!getter) throw new Error('setAuthTokenGetter appelé sans argument');
    expect(getter).toBeTypeOf('function');
  });

  it('le getter enregistré renvoie le jeton de session de Clerk', async () => {
    renderPage('/ci/inscription/client');

    const getter = mocks.setAuthTokenGetter.mock.calls[0]?.[0];
    if (!getter) throw new Error('setAuthTokenGetter appelé sans argument');
    await expect(getter()).resolves.toBe('session-token');
  });
});

describe('RegisterRolePage — bootstrap d’un utilisateur connecté', () => {
  it('bootstrap le rôle client puis redirige vers /ci', async () => {
    mocks.isSignedIn = true;

    renderPage('/ci/inscription/client');

    expect(await screen.findByTestId('home')).toBeInTheDocument();
    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'client', market: 'CI' });
    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/ci$/);
  });

  it('bootstrap le rôle gérant du marché bj puis redirige vers /bj', async () => {
    mocks.isSignedIn = true;

    renderPage('/bj/inscription/gerant');

    expect(await screen.findByTestId('home')).toBeInTheDocument();
    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'gerant', market: 'BJ' });
    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/bj$/);
  });

  it('redirige même quand le bootstrap échoue', async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockRejectedValue(new Error('bootstrap en échec'));

    renderPage('/ci/inscription/client');

    expect(await screen.findByTestId('home')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/ci$/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('n’appelle bootstrap qu’une seule fois par rendu connecté', async () => {
    mocks.isSignedIn = true;

    renderPage('/ci/inscription/client');
    await screen.findByTestId('home');

    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas bootstrap pour un visiteur déconnecté", () => {
    mocks.isSignedIn = false;

    renderPage('/ci/inscription/client');

    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client');
    expect(screen.getByTestId('clerk-signup')).toBeInTheDocument();
  });

  it("n'appelle pas bootstrap tant que Clerk n'a pas chargé", () => {
    mocks.isLoaded = false;
    mocks.isSignedIn = true;

    renderPage('/ci/inscription/client');

    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client');
  });

  it("ne déclenche aucune requête réseau non mockée", async () => {
    mocks.isSignedIn = true;

    renderPage('/ci/inscription/client');
    await screen.findByTestId('home');

    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.cachedGet).not.toHaveBeenCalled();
  });

  it('n’effectue aucune navigation si la page est démontée pendant le bootstrap', async () => {
    mocks.isSignedIn = true;
    let resolveBootstrap!: (value: BootstrapResult) => void;
    mocks.bootstrap.mockReturnValue(
      new Promise<BootstrapResult>((resolve) => {
        resolveBootstrap = resolve;
      }),
    );

    const { rerenderHost } = renderPage('/ci/inscription/client');
    await waitFor(() => expect(mocks.bootstrap).toHaveBeenCalledTimes(1));

    // La page est démontée avant que le bootstrap ne revienne.
    rerenderHost({ showPage: false });
    expect(screen.getByTestId('page-placeholder')).toBeInTheDocument();

    await act(async () => {
      resolveBootstrap({ role: 'client', profile_role: null, clerk_role: null });
    });

    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client');
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });
});

describe('RegisterRolePage — racine /inscription', () => {
  it('redirige /ci/inscription vers /ci/inscription/client', async () => {
    window.history.replaceState({}, '', '/ci/inscription');

    renderPage('/ci/inscription');

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client'),
    );
    expect(screen.getByTestId('nav-type')).toHaveTextContent('REPLACE');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it('redirige /bj/inscription vers /bj/inscription/client', async () => {
    window.history.replaceState({}, '', '/bj/inscription');

    renderPage('/bj/inscription');

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/inscription/client'),
    );
    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/inscription/client');
  });
});

describe('RegisterRolePage — clé Clerk absente', () => {
  // `clerkConfigured` est figé au chargement du module : resetModules + import
  // dynamique pour obtenir une page qui ne voit pas la clé du .env de test.
  it("signale l'absence de clé Clerk plutôt que d'afficher le formulaire", async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();

    const mod = await import('./RegisterRolePage');
    renderPage('/ci/inscription/client', { Page: mod.default });

    expect(screen.getByText('Clé Clerk manquante dans frontend/.env')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-signup')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Votre espace client vous attend' }),
    ).not.toBeInTheDocument();
  });

  it('refuse une clé Clerk qui ne commence pas par pk_', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'sk_test_pas_une_cle_publique');
    vi.resetModules();

    const mod = await import('./RegisterRolePage');
    renderPage('/ci/inscription/client', { Page: mod.default });

    expect(screen.getByText('Clé Clerk manquante dans frontend/.env')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-signup')).not.toBeInTheDocument();
  });

  it('ne tente aucun bootstrap sans clé Clerk, même connecté', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    mocks.isSignedIn = true;

    const mod = await import('./RegisterRolePage');
    renderPage('/ci/inscription/client', { Page: mod.default });

    expect(screen.getByText('Clé Clerk manquante dans frontend/.env')).toBeInTheDocument();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription/client');
  });
});
