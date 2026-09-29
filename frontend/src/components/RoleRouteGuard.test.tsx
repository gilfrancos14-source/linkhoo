import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoleRouteGuard from './RoleRouteGuard';
import type { AuthRole } from '../lib/api';

type BootstrapArgs = { role: AuthRole; market?: 'CI' | 'BJ' };

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn<(args: { role: 'client' | 'gerant'; market?: 'CI' | 'BJ' }) => Promise<{
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

vi.mock('../lib/api', () => ({
  apiAuth: { bootstrap: mocks.bootstrap },
  setAuthTokenGetter: mocks.setAuthTokenGetter,
}));

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
