import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from './App';

// Tous les stubs jsdom et l'état des mocks sont posés AVANT l'évaluation des
// vi.mock : les factories de mock sont hoistées au-dessus des imports.
const mocks = vi.hoisted(() => {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  if (!('IntersectionObserver' in globalThis)) {
    globalThis.IntersectionObserver =
      IntersectionObserverStub as unknown as typeof IntersectionObserver;
  }
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
  // ScrollToTop de App.tsx appelle window.scrollTo : jsdom ne l'implémente
  // pas proprement, on le remplace par un spy consultable.
  const scrollTo = vi.fn<(x?: number, y?: number) => void>();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;

  // Fabrique d'objets d'API auto-mochés : toute méthode appelée renvoie [] .
  const autoApi = () =>
    new Proxy<Record<string, unknown>>({}, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (!(prop in target)) {
          target[prop] = vi.fn(() => Promise.resolve([]));
        }
        return target[prop];
      },
    });
  const autoFn = vi.fn(() => Promise.resolve([]));

  return {
    scrollTo,
    autoApi,
    autoFn,
    // --- Clerk ---
    clerkLoaded: true,
    clerkSignedIn: false,
    getToken: vi.fn<() => Promise<string | null>>(),
    signOut: vi.fn<() => Promise<void>>(),
    // --- lib/api ---
    setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
    bootstrap: vi.fn<
      (args: { role: 'client' | 'gerant'; market?: 'CI' | 'BJ' }) => Promise<{
        role: 'client' | 'gerant' | null;
        profile_role: 'client' | 'gerant' | null;
        clerk_role: 'client' | 'gerant' | null;
      }>
    >(),
    me: vi.fn<() => Promise<{ role: 'client' | 'gerant' | null }>>(),
    getPopular: vi.fn<(market: string) => Promise<unknown[]>>(),
    featured: vi.fn<() => Promise<unknown[]>>(),
    subscribe: vi.fn<(args: { email: string; market?: string }) => Promise<void>>(),
    // --- lib/adminApi ---
    getAdminToken: vi.fn<() => string | null>(),
    adminGetMe: vi.fn<() => Promise<{ id: string; email: string }>>(),
    // --- lib/notifications ---
    getClientNotifications: vi.fn<() => Promise<unknown[]>>(),
    markClientNotificationAsRead: vi.fn<(id: string) => Promise<void>>(),
    // --- data/* ---
    fetchRoomsByMarket: vi.fn<() => Promise<unknown[]>>(),
    fetchAvailableRooms: vi.fn<() => Promise<unknown[]>>(),
    fetchCategoriesByMarket: vi.fn<() => Promise<unknown[]>>(),
    fetchBannersBySection: vi.fn<() => Promise<unknown[]>>(),
    fetchEventsByMarket: vi.fn<() => Promise<unknown[]>>(),
    // --- drapeaux de test ---
    throwOnCategory: false,
    resolveRoomDetail: (() => {}) as () => void,
  };
});

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.clerkLoaded,
    isSignedIn: mocks.clerkSignedIn,
    getToken: mocks.getToken,
  }),
  useClerk: () => ({ signOut: mocks.signOut }),
  useUser: () => ({ user: null }),
  SignIn: (props: { path?: string; signUpUrl?: string; fallbackRedirectUrl?: string }) => (
    <div
      data-testid="clerk-signin"
      data-path={props.path}
      data-signup={props.signUpUrl}
      data-redirect={props.fallbackRedirectUrl}
    />
  ),
  SignUp: () => <div data-testid="clerk-signup" />,
  ClerkProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./lib/api', () => ({
  API_BASE: '/api',
  REQUEST_TIMEOUT_MS: 15_000,
  setAuthTokenGetter: mocks.setAuthTokenGetter,
  clearApiCache: vi.fn(),
  cachedGet: mocks.autoFn,
  parseJsonBody: mocks.autoFn,
  request: mocks.autoFn,
  apiRooms: { getPopular: mocks.getPopular },
  apiBanners: mocks.autoApi(),
  apiEvents: mocks.autoApi(),
  apiReservations: mocks.autoApi(),
  apiNewsletter: { subscribe: mocks.subscribe },
  apiNotifications: mocks.autoApi(),
  apiUpload: mocks.autoApi(),
  apiGerants: mocks.autoApi(),
  apiPremium: mocks.autoApi(),
  apiAuth: { bootstrap: mocks.bootstrap, me: mocks.me },
  apiClients: mocks.autoApi(),
  apiReviews: { featured: mocks.featured },
  apiContact: { send: mocks.autoFn },
}));

vi.mock('./lib/adminApi', () => ({
  API_BASE: '/api',
  getAdminToken: mocks.getAdminToken,
  setAdminToken: vi.fn(),
  apiAdmin: {
    getMe: mocks.adminGetMe,
    login: vi.fn(() => Promise.resolve({ token: 'jwt-test' })),
  },
}));

vi.mock('./lib/notifications', () => ({
  getClientNotifications: mocks.getClientNotifications,
  markClientNotificationAsRead: mocks.markClientNotificationAsRead,
  getNotifications: mocks.autoFn,
  markAsRead: mocks.autoFn,
  markAllAsRead: mocks.autoFn,
  addClientNotification: mocks.autoFn,
}));

// Les modules data/* sont mockés partiellement : les helpers purs
// (formatEventDate, groupEventsByCity…) restent réels, seule l'API part.
vi.mock('./data/rooms', async (importOriginal) => {
  const original = await importOriginal<typeof import('./data/rooms')>();
  return {
    ...original,
    fetchRoomsByMarket: mocks.fetchRoomsByMarket,
    fetchAvailableRooms: mocks.fetchAvailableRooms,
  };
});

vi.mock('./data/categories', async (importOriginal) => {
  const original = await importOriginal<typeof import('./data/categories')>();
  return { ...original, fetchCategoriesByMarket: mocks.fetchCategoriesByMarket };
});

vi.mock('./data/banners', async (importOriginal) => {
  const original = await importOriginal<typeof import('./data/banners')>();
  return { ...original, fetchBannersBySection: mocks.fetchBannersBySection };
});

vi.mock('./data/events', async (importOriginal) => {
  const original = await importOriginal<typeof import('./data/events')>();
  return { ...original, fetchEventsByMarket: mocks.fetchEventsByMarket };
});

// --- Pages lazy remplacées par de légers doubles de test -------------------
vi.mock('./pages/ClientComptePage', () => ({
  default: () => <div data-testid="page-compte">Espace client (stub)</div>,
}));

vi.mock('./pages/gerant/AdminLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    default: () => (
      <div data-testid="gerant-layout">
        <p>Espace gérant (stub)</p>
        <Outlet />
      </div>
    ),
  };
});

vi.mock('./pages/gerant/DashboardPage', () => ({
  default: () => <div data-testid="gerant-dashboard">Tableau de bord gérant (stub)</div>,
}));

vi.mock('./pages/admin/SuperAdminLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    default: () => (
      <div data-testid="admin-layout">
        <p>Console admin (stub)</p>
        <Outlet />
      </div>
    ),
  };
});

vi.mock('./pages/admin/AdminDashboardPage', () => ({
  default: () => <div data-testid="admin-dashboard">Tableau de bord admin (stub)</div>,
}));

// Import lazy volontairement suspendu : permet d'observer le fallback Suspense.
vi.mock(
  './pages/RoomDetailPage',
  () =>
    new Promise((resolve) => {
      mocks.resolveRoomDetail = () =>
        resolve({
          default: () => <div data-testid="page-chambre">Chambre 42 (stub)</div>,
        });
    }),
);

// Page qui plante au rendu : vérifie que l'ErrorBoundary de App.tsx absorbe.
vi.mock('./pages/CategoryPage', () => ({
  default: () => {
    if (mocks.throwOnCategory) {
      throw new Error('boom catégorie');
    }
    return <div data-testid="page-categorie">Catégorie (stub)</div>;
  },
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderApp(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clerkLoaded = true;
  mocks.clerkSignedIn = false;
  mocks.getToken.mockResolvedValue('session-token');
  mocks.signOut.mockResolvedValue(undefined);
  mocks.bootstrap.mockResolvedValue({ role: 'client', profile_role: null, clerk_role: null });
  mocks.me.mockResolvedValue({ role: null });
  mocks.getPopular.mockResolvedValue([]);
  mocks.featured.mockResolvedValue([]);
  mocks.subscribe.mockResolvedValue(undefined);
  mocks.getAdminToken.mockReturnValue(null);
  mocks.adminGetMe.mockResolvedValue({ id: 'admin-1', email: 'admin@ilehya.ci' });
  mocks.getClientNotifications.mockResolvedValue([]);
  mocks.markClientNotificationAsRead.mockResolvedValue(undefined);
  mocks.fetchRoomsByMarket.mockResolvedValue([]);
  mocks.fetchAvailableRooms.mockResolvedValue([]);
  mocks.fetchCategoriesByMarket.mockResolvedValue([]);
  mocks.fetchBannersBySection.mockResolvedValue([]);
  mocks.fetchEventsByMarket.mockResolvedValue([]);
  mocks.throwOnCategory = false;
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-market');
});

describe('App — racine et marché', () => {
  it('rend la landing CoinAfrique à la racine, avec header et footer', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: /La location directe en Afrique/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(document.documentElement.hasAttribute('data-market')).toBe(false);
    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
  });

  it("redirige un segment de marché invalide vers la racine", async () => {
    renderApp('/ch');

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/'));
    expect(
      await screen.findByRole('heading', { level: 1, name: /La location directe en Afrique/ }),
    ).toBeInTheDocument();
  });

  it("redirige une URL inconnue hors marché vers la racine", async () => {
    renderApp('/togo/quelque-part');

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/'));
    expect(
      await screen.findByRole('heading', { level: 1, name: /La location directe en Afrique/ }),
    ).toBeInTheDocument();
  });

  it("rend la page d'accueil complète du marché CI", async () => {
    renderApp('/ci');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Trouvez le lieu idéal pour votre prochain séjour',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-market')).toBe('CI');
  });

  it("applique le thème BJ sur l'accueil /bj", async () => {
    renderApp('/bj');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Trouvez le lieu idéal pour votre prochain séjour',
      }),
    ).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-market')).toBe('BJ');
  });

  it("affiche la page 404 interne pour une route inconnue du marché", async () => {
    renderApp('/ci/page-inconnue');

    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/ci');
  });
});

describe('App — pages de contenu (intégration)', () => {
  it("rend les mentions légales depuis /ci/mentions-legales", async () => {
    renderApp('/ci/mentions-legales');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mentions légales' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(8);
  });

  it("rend la politique de confidentialité depuis /bj/politique-de-confidentialite", async () => {
    renderApp('/bj/politique-de-confidentialite');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Politique de confidentialité' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
    expect(screen.getByRole('link', { name: "← Retour à l'accueil" })).toHaveAttribute('href', '/bj');
  });

  it("rend la page À propos depuis /a-propos", async () => {
    renderApp('/a-propos');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'À propos de Linkhoo' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    expect(screen.getByRole('link', { name: "← Retour à l'accueil" })).toHaveAttribute('href', '/');
  });

  it("rend la page Contact depuis /contact", async () => {
    renderApp('/contact');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Contactez-nous' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "← Retour à l'accueil" })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pays *')).toBeInTheDocument();
  });

  it("redirige /ci/contact vers /contact", async () => {
    renderApp('/ci/contact');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Contactez-nous' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/contact');
  });

  it("redirige /bj/a-propos vers /a-propos", async () => {
    renderApp('/bj/a-propos');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'À propos de Linkhoo' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/a-propos');
  });

  it("rend la connexion client sur /ci/login sans chrome de marché", async () => {
    renderApp('/ci/login');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Heureux de vous revoir' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('clerk-signin')).toHaveAttribute('data-path', '/ci/login');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it("propage le marché aux <Routes> imbriqués : /bj/login configure Clerk en bj", async () => {
    renderApp('/bj/login');

    await screen.findByRole('heading', { level: 1, name: 'Heureux de vous revoir' });
    const signIn = screen.getByTestId('clerk-signin');
    expect(signIn).toHaveAttribute('data-path', '/bj/login');
    expect(signIn).toHaveAttribute('data-signup', '/bj/inscription');
    expect(signIn).toHaveAttribute('data-redirect', '/bj/compte');
  });

  it("rend le suivi de réservation sur /ci/suivi-reservation avec le chrome", async () => {
    renderApp('/ci/suivi-reservation');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Suivi de réservation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    // Le pied de page propose aussi un lien « Se connecter » : on se scope
    // sur le conteneur de la page pour vérifier la cible marché.
    const page = within(screen.getByRole('main'));
    expect(page.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/ci/login');
  });

  it("rend la connexion gérant sur /ci/login/gerant", async () => {
    renderApp('/ci/login/gerant');

    expect(await screen.findByRole('heading', { level: 1, name: 'Espace gérants' })).toBeInTheDocument();
    expect(screen.getByTestId('clerk-signin')).toHaveAttribute('data-path', '/ci/login/gerant');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});

describe('App — guards client / gérant', () => {
  it("redirige /ci/compte non connecté vers /ci/login", async () => {
    renderApp('/ci/compte');

    expect(await screen.findByRole('heading', { level: 1, name: 'Heureux de vous revoir' })).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/login');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it("redirige /bj/compte non connecté vers /bj/login", async () => {
    renderApp('/bj/compte');

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/login'));
    expect(screen.getByTestId('clerk-signin')).toHaveAttribute('data-path', '/bj/login');
  });

  it("ouvre l'espace client pour un client connecté et bootstrape en bj", async () => {
    mocks.clerkSignedIn = true;

    renderApp('/bj/compte');

    expect(await screen.findByTestId('page-compte')).toBeInTheDocument();
    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'client', market: 'BJ' });
    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/compte');
  });

  it("bascule vers l'espace gérant quand le bootstrap renvoie un autre rôle", async () => {
    mocks.clerkSignedIn = true;
    mocks.bootstrap.mockResolvedValue({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant' });

    renderApp('/ci/compte');

    expect(await screen.findByTestId('gerant-layout')).toBeInTheDocument();
    expect(screen.getByTestId('gerant-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('page-compte')).not.toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/gerant');
  });

  it("redirige /ci/gerant non connecté vers /ci/login/gerant", async () => {
    renderApp('/ci/gerant');

    expect(await screen.findByRole('heading', { level: 1, name: 'Espace gérants' })).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/login/gerant');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it("ouvre l'espace gérant pour un gérant connecté", async () => {
    mocks.clerkSignedIn = true;
    mocks.bootstrap.mockResolvedValue({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant' });

    renderApp('/ci/gerant');

    expect(await screen.findByTestId('gerant-layout')).toBeInTheDocument();
    expect(screen.getByTestId('gerant-dashboard')).toBeInTheDocument();
    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'gerant', market: 'CI' });
  });
});

describe('App — back-office admin', () => {
  it("rend la connexion admin racine sur /admin/login", async () => {
    renderApp('/admin/login');

    expect(await screen.findByRole('heading', { level: 1, name: 'Linkhoo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it("redirige /admin sans token vers /admin/login", async () => {
    mocks.getAdminToken.mockReturnValue(null);

    renderApp('/admin');

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/admin/login'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Linkhoo' })).toBeInTheDocument();
    expect(mocks.adminGetMe).not.toHaveBeenCalled();
  });

  it("ouvre la console admin authentifiée sur /admin", async () => {
    mocks.getAdminToken.mockReturnValue('jwt-admin');
    mocks.adminGetMe.mockResolvedValue({ id: 'admin-1', email: 'admin@ilehya.ci' });

    renderApp('/admin');

    expect(await screen.findByTestId('admin-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/admin');
  });

  it("détecte le marché sur /bj/admin et redirige vers /bj/admin/login", async () => {
    mocks.getAdminToken.mockReturnValue(null);

    renderApp('/bj/admin');

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/bj/admin/login'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Linkhoo' })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});

describe('App — lazy, chrome et résilience', () => {
  it("affiche le fallback Suspense puis la page lazy chargée", async () => {
    renderApp('/ci/chambre/42');

    const fallbacks = await screen.findAllByText('Chargement...');
    expect(fallbacks.length).toBeGreaterThan(0);
    expect(typeof mocks.resolveRoomDetail).toBe('function');

    await act(async () => {
      mocks.resolveRoomDetail();
    });

    expect(await screen.findByTestId('page-chambre')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it("capture l'erreur d'une page qui plante et propose de réessayer", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.throwOnCategory = true;

    renderApp('/ci/categorie/3');

    expect(await screen.findByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("ramène en haut de la page à chaque changement de route", async () => {
    renderApp('/ci/mentions-legales');
    await screen.findByRole('heading', { level: 1, name: 'Mentions légales' });

    expect(mocks.scrollTo).toHaveBeenCalledWith(0, 0);
    const callsAfterMount = mocks.scrollTo.mock.calls.length;

    await userEvent.click(screen.getByRole('link', { name: "← Retour à l'accueil" }));
    await screen.findByRole('heading', {
      level: 1,
      name: 'Trouvez le lieu idéal pour votre prochain séjour',
    });

    expect(mocks.scrollTo.mock.calls.length).toBeGreaterThan(callsAfterMount);
    expect(mocks.scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it("masque le chrome sur la route d'inscription /ci/inscription", async () => {
    renderApp('/ci/inscription');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Votre espace client vous attend' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/inscription');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
