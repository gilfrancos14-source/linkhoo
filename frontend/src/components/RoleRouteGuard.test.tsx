import type { MarketCode } from '../config/markets';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoleRouteGuard, { resetAuthRedirectBudget, resolveDestination } from './RoleRouteGuard';
import { ApiError, type AuthRole } from '../lib/api';

type BootstrapArgs = { role: AuthRole; market?: MarketCode };

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn<(args: { role: 'client' | 'gerant'; market?: MarketCode }) => Promise<{
    role: 'client' | 'gerant' | null;
    profile_role: 'client' | 'gerant' | null;
    clerk_role: 'client' | 'gerant' | null;
  }>>(),
  setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
  getToken: vi.fn<() => Promise<string | null>>(),
  signOut: vi.fn<() => Promise<void>>(),
  isLoaded: true,
  isSignedIn: false,
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
    getToken: mocks.getToken,
  }),
  useClerk: () => ({ signOut: mocks.signOut }),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiAuth: { bootstrap: mocks.bootstrap },
    setAuthTokenGetter: mocks.setAuthTokenGetter,
  };
});

function renderGuard(
  role: AuthRole,
  entry: string,
  Guard: typeof RoleRouteGuard = RoleRouteGuard,
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:market/login/gerant" element={<div>Connexion gérant</div>} />
        <Route path="/:market/login" element={<div>Connexion client</div>} />
        <Route path="/:market/gerant" element={<div>Espace gérant</div>} />
        <Route path="/:market/compte" element={<div>Mon compte</div>} />
        <Route path="/:market" element={<div>Accueil</div>} />
        <Route
          path="/:market/*"
          element={
            <Guard role={role}>
              <div>Contenu protégé</div>
            </Guard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function bootstrapArgsAt(index: number): BootstrapArgs {
  const call = mocks.bootstrap.mock.calls[index];
  if (!call) throw new Error(`bootstrap non appelé à l'index ${index}`);
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthRedirectBudget();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
  mocks.getToken.mockResolvedValue('session-token');
  mocks.signOut.mockResolvedValue(undefined);
  mocks.bootstrap.mockResolvedValue({ role: 'client', profile_role: null, clerk_role: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('RoleRouteGuard', () => {
  it('redirige un client non connecté vers /ci/login', async () => {
    renderGuard('client', '/ci/protege');

    expect(await screen.findByText('Connexion client')).toBeInTheDocument();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it('enregistre le getToken de Clerk comme getter de jeton', async () => {
    renderGuard('client', '/ci/protege');
    await screen.findByText('Connexion client');

    expect(mocks.setAuthTokenGetter).toHaveBeenCalledTimes(1);
    const getter = mocks.setAuthTokenGetter.mock.calls[0]?.[0];
    if (!getter) throw new Error('setAuthTokenGetter appelé sans argument');
    await expect(getter()).resolves.toBe('session-token');
  });

  it("redirige un gérant non connecté vers /ci/login/gerant", async () => {
    renderGuard('gerant', '/ci/protege');

    expect(await screen.findByText('Connexion gérant')).toBeInTheDocument();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it("affiche le chargement tant que Clerk n'a pas chargé", () => {
    mocks.isLoaded = false;
    renderGuard('client', '/ci/protege');

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it('rend les children quand le client est connecté et que le rôle correspond', async () => {
    mocks.isSignedIn = true;

    renderGuard('client', '/ci/protege');

    expect(await screen.findByText('Contenu protégé')).toBeInTheDocument();
    expect(bootstrapArgsAt(0)).toEqual({ role: 'client', market: 'CI' });
  });

  it('rend les children quand le gérant est connecté et que le rôle correspond', async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockResolvedValue({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant' });

    renderGuard('gerant', '/bj/protege');

    expect(await screen.findByText('Contenu protégé')).toBeInTheDocument();
    expect(bootstrapArgsAt(0)).toEqual({ role: 'gerant', market: 'BJ' });
  });

  it("redirige un client connecté dont le bootstrap renvoie un autre rôle vers /ci/gerant", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockResolvedValue({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant' });

    renderGuard('client', '/ci/protege');

    expect(await screen.findByText('Espace gérant')).toBeInTheDocument();
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument();
  });

  it("redirige un gérant connecté dont le bootstrap renvoie un autre rôle vers /ci/compte", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockResolvedValue({ role: 'client', profile_role: 'client', clerk_role: 'client' });

    renderGuard('gerant', '/ci/protege');

    expect(await screen.findByText('Mon compte')).toBeInTheDocument();
  });

  it("redirige un gérant de CI vers /ci/gerant quand le bootstrap échoue avec 409 market=CI", async () => {
    mocks.isSignedIn = true;
    // Le backend renvoie 409 avec le marché réel du compte gérant
    mocks.bootstrap.mockRejectedValue(
      new ApiError('Compte gérant déjà enregistré sur le marché CI', 409, { market: 'CI' }),
    );

    renderGuard('gerant', '/bj/protege');

    expect(await screen.findByText('Espace gérant')).toBeInTheDocument();
  });

  it("redirige vers /ci/gerant si le bootstrap échoue avec un message évoquant le rôle gerant", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockRejectedValue(new Error('Ce compte possède un rôle gerant'));

    renderGuard('client', '/ci/protege');

    expect(await screen.findByText('Espace gérant')).toBeInTheDocument();
  });

  it("redirige vers /ci/compte si le bootstrap échoue avec un message évoquant le rôle client", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockRejectedValue(new Error('Ce compte possède un rôle client'));

    renderGuard('gerant', '/ci/protege');

    expect(await screen.findByText('Mon compte')).toBeInTheDocument();
  });

  it("affiche une erreur avec les actions après l'échec répété du bootstrap", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockRejectedValue(new Error('Service indisponible'));

    renderGuard('client', '/ci/protege');

    const alert = await screen.findByRole('alert', {}, { timeout: 6000 });
    expect(alert).toHaveTextContent('Service indisponible');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();

    const signOutButton = screen.getByRole('button', { name: 'Se déconnecter' });
    await userEvent.click(signOutButton);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    // 1 tentative initiale + 2 retries avant d'afficher l'erreur.
    expect(mocks.bootstrap).toHaveBeenCalledTimes(3);
  });

  it('ne réessaie pas un 429 (trop de requêtes) et affiche le message du serveur', async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockRejectedValue(
      new ApiError('Trop de requêtes, veuillez réessayer plus tard', 429),
    );

    renderGuard('client', '/ci/protege');

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toHaveTextContent('Trop de requêtes');
    // Un 4xx est définitif : une seule tentative, pas d'amplification du 429.
    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('redirige vers /${market} quand VITE_CLERK_PUBLISHABLE_KEY est absente', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    const fresh = await import('./RoleRouteGuard');

    renderGuard('client', '/bj/protege', fresh.default);

    expect(await screen.findByText('Accueil')).toBeInTheDocument();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
});

// Arborescence MIRROIR de App.tsx : /compte et /gerant sont deux frères du
// même <Routes>, chacun enveloppé d'un <RoleRouteGuard>. Comme les deux gardes
// sont du MÊME type à la MÊME position, React réutilise l'instance en passant
// de l'un à l'autre (l'état `status` ne devait donc jamais survivre).
function renderEspace(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:market/login/gerant" element={<div>Connexion gérant</div>} />
        <Route path="/:market/login" element={<div>Connexion client</div>} />
        <Route
          path="/:market/compte"
          element={
            <RoleRouteGuard role="client">
              <div>Mon compte</div>
            </RoleRouteGuard>
          }
        />
        <Route
          path="/:market/gerant"
          element={
            <RoleRouteGuard role="gerant">
              <div>Espace gérant</div>
            </RoleRouteGuard>
          }
        />
        <Route path="/:market" element={<div>Accueil</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleRouteGuard — convergence (pas de boucle de redirection)', () => {
  it("converge vers /gerant quand un gérant atterrit sur /compte (409 rôle gérant)", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockImplementation(({ role }) =>
      role === 'gerant'
        ? Promise.resolve({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant' })
        : Promise.reject(
            new ApiError('Compte déjà enregistré comme gerant', 409, { role: 'gerant' }),
          ),
    );

    renderEspace('/ci/compte');

    expect(
      await screen.findByText('Espace gérant', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Mon compte')).not.toBeInTheDocument();
  });

  it("converge vers /compte quand un client atterrit sur /gerant (409 rôle client)", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockImplementation(({ role }) =>
      role === 'client'
        ? Promise.resolve({ role: 'client', profile_role: 'client', clerk_role: 'client' })
        : Promise.reject(
            new ApiError('Compte déjà enregistré comme client', 409, { role: 'client' }),
          ),
    );

    renderEspace('/ci/gerant');

    expect(
      await screen.findByText('Mon compte', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Espace gérant')).not.toBeInTheDocument();
  });
});

describe('resolveDestination (fonction pure)', () => {
  it('ne redirige jamais vers l’URL courante en cas de mauvais rôle', () => {
    const dest = resolveDestination({
      outcome: { kind: 'wrong-role' },
      wrongRolePath: '/ci/gerant',
      currentPath: '/ci/gerant',
    });
    expect(dest).toEqual({ kind: 'error', message: 'Espace introuvable pour ce compte.' });
  });

  it('ne redirige jamais vers l’URL courante en cas de mauvais marché', () => {
    const dest = resolveDestination({
      outcome: { kind: 'wrong-market', market: 'CI' },
      wrongRolePath: '/ci/compte',
      currentPath: '/ci/gerant',
    });
    expect(dest).toEqual({ kind: 'ok' });
  });

  it('redirige vers le bon espace gérant pour un autre marché', () => {
    const dest = resolveDestination({
      outcome: { kind: 'wrong-market', market: 'BJ' },
      wrongRolePath: '/ci/compte',
      currentPath: '/ci/gerant',
    });
    expect(dest).toEqual({ kind: 'redirect', path: '/bj/gerant' });
  });

  it('reste en chargement tant que le résultat de bootstrap est absent', () => {
    const dest = resolveDestination({
      outcome: null,
      wrongRolePath: '/ci/compte',
      currentPath: '/ci/gerant',
    });
    expect(dest).toEqual({ kind: 'loading' });
  });
});

describe('RoleRouteGuard — cas limites', () => {
  it("redirige un gérant vers son marché réel quand il atterrit sur un autre marché (409 market=BJ)", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockImplementation(({ role, market }) => {
      if (role === 'gerant' && market === 'BJ') {
        return Promise.resolve({ role: 'gerant', profile_role: 'gerant', clerk_role: 'gerant' });
      }
      return Promise.reject(new ApiError('Mauvais marché', 409, { market: 'BJ' }));
    });

    renderEspace('/ci/gerant');

    expect(await screen.findByText('Espace gérant', {}, { timeout: 3000 })).toBeInTheDocument();
    const markets = mocks.bootstrap.mock.calls.map((c) => c[0].market);
    expect(markets).toContain('CI');
    expect(markets).toContain('BJ');
  });

  it('déclenche le disjoncteur après trop de redirections et ne boucle plus', async () => {
    mocks.isSignedIn = true;
    // Le serveur renvoie toujours le rôle OPPOSÉ au rôle attendu → chaque garde
    // redirige vers l'autre espace, qui redirige à son tour : ping-pong infini.
    mocks.bootstrap.mockImplementation(({ role }) =>
      Promise.resolve(
        role === 'client'
          ? { role: 'gerant' as const, profile_role: null, clerk_role: null }
          : { role: 'client' as const, profile_role: null, clerk_role: null },
      ),
    );

    renderEspace('/ci/compte');

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent('Redirection en boucle détectée');
    // La boucle est née puis a été contenue : pas plus de (MAX + 1) redirections.
    expect(mocks.bootstrap.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("affiche l'erreur du serveur pour un compte inexistant (4xx définitif)", async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap.mockRejectedValue(
      new ApiError('Compte introuvable', 404),
    );

    renderGuard('client', '/ci/protege');

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toHaveTextContent('Compte introuvable');
    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('réessaie un 500 (erreur transitoire) avant de réussir', async () => {
    mocks.isSignedIn = true;
    mocks.bootstrap
      .mockRejectedValueOnce(new ApiError('Service indisponible', 500))
      .mockResolvedValue({ role: 'client', profile_role: 'client', clerk_role: 'client' });

    renderGuard('client', '/ci/protege');

    expect(await screen.findByText('Contenu protégé', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(mocks.bootstrap).toHaveBeenCalledTimes(2);
  });
});

