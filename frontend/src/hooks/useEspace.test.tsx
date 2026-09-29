import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import { useEspace } from './useEspace';

type AuthRoleLike = 'client' | 'gerant';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(to: string, opts?: { replace?: boolean }) => void>(),
  getToken: vi.fn<() => Promise<string | null>>(),
  isLoaded: true,
  isSignedIn: true,
  user: null as { unsafeMetadata?: unknown; publicMetadata?: unknown } | null,
  me: vi.fn<() => Promise<{ role: AuthRoleLike | null }>>(),
  bootstrap: vi.fn<(args: { role: AuthRoleLike; market?: 'CI' | 'BJ' }) => Promise<unknown>>(),
  setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
}));

// useNavigate est remplacé : on asserte les destinations (chemin + replace)
// sans installer de <Routes>, MarketProvider gardant useLocation réel.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: mocks.getToken,
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
  }),
  useUser: () => ({ user: mocks.user }),
}));

vi.mock('../lib/api', () => ({
  apiAuth: { me: mocks.me, bootstrap: mocks.bootstrap },
  setAuthTokenGetter: mocks.setAuthTokenGetter,
}));

let resolveRef: (() => Promise<void>) | null = null;

function Probe() {
  const { resolve, loading } = useEspace();
  resolveRef = resolve;
  return <span data-testid="loading">{loading ? 'chargement' : 'repos'}</span>;
}

function renderHook(entry = '/ci/espace') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Probe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

async function resolveEspace(): Promise<void> {
  if (!resolveRef) throw new Error('useEspace non monté');
  await act(async () => {
    await resolveRef!();
  });
}

// Déclenche resolve() sous timer fausse (attentes de 800 ms du hook).
async function resolveEspaceWithFakeTimers(totalMs: number): Promise<void> {
  if (!resolveRef) throw new Error('useEspace non monté');
  vi.useFakeTimers();
  try {
    await act(async () => {
      const pending = resolveRef!();
      await vi.advanceTimersByTimeAsync(totalMs);
      await pending;
    });
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveRef = null;
  mocks.isLoaded = true;
  mocks.isSignedIn = true;
  mocks.user = null;
  mocks.getToken.mockResolvedValue('session-token');
  mocks.me.mockResolvedValue({ role: 'client' });
  mocks.bootstrap.mockResolvedValue({
    role: 'client',
    profile_role: null,
    clerk_role: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('enregistrement du jeton Clerk', () => {
  it('enregistre getToken comme getter de jeton au montage', async () => {
    renderHook();

    expect(mocks.setAuthTokenGetter).toHaveBeenCalledTimes(1);
    const getter = mocks.setAuthTokenGetter.mock.calls[0]?.[0];
    if (!getter) throw new Error('setAuthTokenGetter appelé sans argument');
    await expect(getter()).resolves.toBe('session-token');
  });

  it("ré-enregistre le getter quand l'identité de getToken change", async () => {
    const { rerender } = renderHook();
    expect(mocks.setAuthTokenGetter).toHaveBeenCalledTimes(1);

    mocks.getToken = vi.fn(async () => 'jeton-renouvelle');
    rerender(
      <MemoryRouter initialEntries={['/ci/espace']}>
        <MarketProvider>
          <Probe />
        </MarketProvider>
      </MemoryRouter>,
    );

    expect(mocks.setAuthTokenGetter).toHaveBeenCalledTimes(2);
    const getter = mocks.setAuthTokenGetter.mock.calls[1]?.[0];
    if (!getter) throw new Error('setAuthTokenGetter appelé sans argument');
    await expect(getter()).resolves.toBe('jeton-renouvelle');
  });
});

describe('redirections hors session', () => {
  it("redirige vers /ci/login tant que Clerk n'a pas chargé", async () => {
    mocks.isLoaded = false;

    renderHook('/ci/espace');
    await resolveEspace();

    expect(mocks.navigate).toHaveBeenCalledWith('/ci/login', { replace: true });
    expect(mocks.me).not.toHaveBeenCalled();
  });

  it('redirige vers /ci/login si l’utilisateur n’est pas connecté', async () => {
    mocks.isSignedIn = false;

    renderHook('/ci/espace');
    await resolveEspace();

    expect(mocks.navigate).toHaveBeenCalledWith('/ci/login', { replace: true });
    expect(mocks.me).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading')).toHaveTextContent('repos');
  });

  it('utilise le chemin du marché courant (BJ)', async () => {
    mocks.isSignedIn = false;

    renderHook('/bj/espace');
    await resolveEspace();

    expect(mocks.navigate).toHaveBeenCalledWith('/bj/login', { replace: true });
  });
});

describe('résolution du rôle via apiAuth.me', () => {
  it('navigue vers /ci/compte pour un rôle client', async () => {
    mocks.me.mockResolvedValue({ role: 'client' });

    renderHook('/ci/espace');
    await resolveEspace();

    expect(mocks.me).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading')).toHaveTextContent('repos');
  });

  it("navigue vers /ci/gerant pour un rôle gérant", async () => {
    mocks.me.mockResolvedValue({ role: 'gerant' });

    renderHook('/ci/espace');
    await resolveEspace();

    expect(mocks.navigate).toHaveBeenCalledWith('/ci/gerant', { replace: true });
  });

  it("affiche l'état de chargement pendant la résolution", async () => {
    let settle: (value: { role: AuthRoleLike | null }) => void = () => {};
    mocks.me.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );

    renderHook('/ci/espace');
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = resolveRef?.();
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('chargement');
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      settle({ role: 'client' });
      await pending;
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('repos');
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
  });

  it("réessaie apiAuth.me() 3 fois avant d'abandonner", async () => {
    mocks.me.mockRejectedValue(new Error('API indisponible'));

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.me).toHaveBeenCalledTimes(3);
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  it('réussit après une tentative échouée (2 appels)', async () => {
    mocks.me.mockRejectedValueOnce(new Error('réseau'));
    mocks.me.mockResolvedValueOnce({ role: 'gerant' });

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(1500);

    expect(mocks.me).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/gerant', { replace: true });
  });
});

describe('repli sur les métadonnées Clerk', () => {
  it("retombe sur unsafeMetadata quand me() échoue (bootstrap + navigation)", async () => {
    mocks.me.mockRejectedValue(new Error('API indisponible'));
    mocks.user = { unsafeMetadata: { role: 'gerant' } };

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'gerant', market: 'CI' });
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/gerant', { replace: true });
  });

  it("lit publicMetadata quand unsafeMetadata n'a pas de rôle", async () => {
    mocks.me.mockRejectedValue(new Error('API indisponible'));
    mocks.user = { unsafeMetadata: { theme: 'dark' }, publicMetadata: { role: 'gerant' } };

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'gerant', market: 'CI' });
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/gerant', { replace: true });
  });

  it('utilise les métadonnées quand me() répond sans rôle', async () => {
    mocks.me.mockResolvedValue({ role: null });
    mocks.user = { unsafeMetadata: { role: 'client' } };

    renderHook('/ci/espace');
    await resolveEspace();

    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'client', market: 'CI' });
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
  });

  it("ignore une valeur de rôle inconnue dans les métadonnées", async () => {
    mocks.me.mockRejectedValue(new Error('API indisponible'));
    mocks.user = { unsafeMetadata: { role: 'admin' } };

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
  });

  it('passe le marché BJ au bootstrap sur une URL /bj', async () => {
    mocks.me.mockRejectedValue(new Error('API indisponible'));
    mocks.user = { unsafeMetadata: { role: 'gerant' } };

    renderHook('/bj/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.bootstrap).toHaveBeenCalledWith({ role: 'gerant', market: 'BJ' });
    expect(mocks.navigate).toHaveBeenCalledWith('/bj/gerant', { replace: true });
  });

  it("continue la navigation même si le bootstrap échoue", async () => {
    mocks.me.mockRejectedValue(new Error('API indisponible'));
    mocks.bootstrap.mockRejectedValue(new Error('bootstrap en échec'));
    mocks.user = { unsafeMetadata: { role: 'client' } };

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
  });

  it('navigue vers /ci/compte quand aucun rôle n’est trouvable', async () => {
    mocks.me.mockRejectedValue(new Error('réseau en panne'));

    renderHook('/ci/espace');
    await resolveEspaceWithFakeTimers(2000);

    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/ci/compte', { replace: true });
  });
});
