import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OAuthCallback from './OAuthCallback';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(to: string, opts?: { replace?: boolean }) => void>(),
  handleRedirectCallback: vi.fn<
    (urls: Record<string, string>) => Promise<void>
  >(),
}));

// useNavigate est remplacé par une sonde : on asserte la destination ET
// l'option replace, invisibles avec un vrai <Routes>.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({
    handleRedirectCallback: mocks.handleRedirectCallback,
  }),
}));

function renderCallback(entry = '/ci/oauth-callback', Router = MemoryRouter) {
  return render(
    <Router initialEntries={[entry]}>
      <OAuthCallback />
    </Router>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handleRedirectCallback.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('OAuthCallback', () => {
  it('affiche l’écran « Connexion en cours... » pendant le traitement', () => {
    mocks.handleRedirectCallback.mockImplementation(
      () => new Promise<void>(() => {}),
    );

    const { container } = renderCallback();

    expect(screen.getByText('Connexion en cours...')).toBeInTheDocument();
    expect(container.querySelector('.auth-loading__spinner')).not.toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('délègue le callback à Clerk avec les URLs de repli du marché CI', async () => {
    renderCallback('/ci/oauth-callback');

    expect(mocks.handleRedirectCallback).toHaveBeenCalledTimes(1);
    expect(mocks.handleRedirectCallback).toHaveBeenCalledWith({
      signInFallbackRedirectUrl: '/ci/gerant',
      signUpFallbackRedirectUrl: '/ci/gerant',
    });
    await screen.findByText('Connexion en cours...');
  });

  it('navigue vers /ci/gerant en remplacement après un callback réussi', async () => {
    renderCallback('/ci/oauth-callback');

    expect(await screen.findByText('Connexion en cours...')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/ci/gerant', {
        replace: true,
      }),
    );
  });

  it('retourne à la page de connexion gérant quand le callback échoue', async () => {
    mocks.handleRedirectCallback.mockRejectedValue(new Error('state invalide'));

    renderCallback('/ci/oauth-callback');

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/ci/login/gerant', {
        replace: true,
      }),
    );
    expect(mocks.navigate).not.toHaveBeenCalledWith('/ci/gerant', {
      replace: true,
    });
  });

  it('reconstruit les URLs de repli depuis le segment /bj', async () => {
    renderCallback('/bj/oauth-callback');

    expect(mocks.handleRedirectCallback).toHaveBeenCalledWith({
      signInFallbackRedirectUrl: '/bj/gerant',
      signUpFallbackRedirectUrl: '/bj/gerant',
    });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/bj/gerant', {
        replace: true,
      }),
    );
  });

  it('retombe sur /ci quand l’URL ne contient aucun segment de marché', async () => {
    renderCallback('/oauth-callback');

    expect(mocks.handleRedirectCallback).toHaveBeenCalledWith({
      signInFallbackRedirectUrl: '/ci/gerant',
      signUpFallbackRedirectUrl: '/ci/gerant',
    });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/ci/gerant', {
        replace: true,
      }),
    );
    for (const [to] of mocks.navigate.mock.calls) {
      expect(to).not.toContain('undefined');
    }
  });

  it("n'appelle le callback Clerk qu'une fois malgré un re-rendu", async () => {
    const { rerender } = renderCallback('/ci/oauth-callback');
    await screen.findByText('Connexion en cours...');

    rerender(
      <MemoryRouter initialEntries={['/ci/oauth-callback']}>
        <OAuthCallback />
      </MemoryRouter>,
    );

    expect(mocks.handleRedirectCallback).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it('bascule vers la connexion sans appeler Clerk quand la clé est absente', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    // Import SÉQUENTIEL : un Promise.all juste après resetModules laisse le
    // module fraîchement importé atterrir sur react-router-dom non mocké
    // (constaté : useLocation/useNavigate réels, zéro appel de la sonde).
    const fresh = await import('./OAuthCallback');
    const freshRouter = await import('react-router-dom');

    render(
      <freshRouter.MemoryRouter initialEntries={['/ci/oauth-callback']}>
        <fresh.default />
      </freshRouter.MemoryRouter>,
    );

    expect(screen.getByText('Connexion en cours...')).toBeInTheDocument();
    expect(mocks.handleRedirectCallback).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/ci/login/gerant', {
        replace: true,
      }),
    );
  });
});
