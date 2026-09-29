import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientNotification } from '../lib/notifications';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  getToken: vi.fn<() => Promise<string | null>>(),
  setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
  getClientNotifications: vi.fn<() => Promise<ClientNotification[]>>(),
  markClientNotificationAsRead: vi.fn<(id: string) => Promise<void>>(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
    getToken: mocks.getToken,
  }),
}));

vi.mock('../lib/api', () => ({
  setAuthTokenGetter: mocks.setAuthTokenGetter,
}));

vi.mock('../lib/notifications', () => ({
  getClientNotifications: mocks.getClientNotifications,
  markClientNotificationAsRead: mocks.markClientNotificationAsRead,
}));

function makeNotification(
  overrides: Partial<ClientNotification> = {},
): ClientNotification {
  return {
    id: 'notif-1',
    type: 'reservation_confirmed',
    roomTitle: 'Suite vue mer',
    roomId: 'room-1',
    clientEmail: 'awa@ilehya.ci',
    message: 'Votre réservation est confirmée.',
    date: '2026-01-15T10:00:00.000Z',
    read: false,
    ...overrides,
  };
}

/** Le composant lit import.meta.env au chargement du module : on reimporte. */
async function loadBanner() {
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_Y2xlcmskZW1v');
  vi.resetModules();
  const mod = await import('./ClientNotificationBanner');
  return mod.default;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoaded = true;
  mocks.isSignedIn = true;
  mocks.getToken.mockResolvedValue('session-token');
  mocks.getClientNotifications.mockResolvedValue([]);
  mocks.markClientNotificationAsRead.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('ClientNotificationBanner', () => {
  it('ne rend rien tant que Clerk n’a pas chargé', async () => {
    mocks.isLoaded = false;
    const Banner = await loadBanner();

    const { container } = render(<Banner />);

    expect(container.firstChild).toBeNull();
    expect(mocks.getClientNotifications).not.toHaveBeenCalled();
  });

  it('ne rend rien pour un utilisateur déconnecté', async () => {
    mocks.isSignedIn = false;
    const Banner = await loadBanner();

    const { container } = render(<Banner />);

    expect(container.firstChild).toBeNull();
    expect(mocks.getClientNotifications).not.toHaveBeenCalled();
    expect(mocks.setAuthTokenGetter).not.toHaveBeenCalled();
  });

  it('ne rend rien quand aucune notification n’est non lue', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({ id: 'lue', read: true }),
    ]);
    const Banner = await loadBanner();

    const { container } = render(<Banner />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.getClientNotifications).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.client-notif')).toBeNull();
    expect(screen.queryByText('Réservation confirmée')).toBeNull();
  });

  it('affiche une notification non lue (titre, message, bouton fermer)', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({ message: 'Suite 101 réservée du 2 au 5 mars.' }),
      makeNotification({ id: 'notif-lue', read: true, message: 'Déjà lue.' }),
    ]);
    const Banner = await loadBanner();

    render(<Banner />);

    expect(
      await screen.findByText('Suite 101 réservée du 2 au 5 mars.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Réservation confirmée')).toBeInTheDocument();
    expect(screen.queryByText('Déjà lue.')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Fermer' }),
    ).toBeInTheDocument();
  });

  it('affiche le titre d’erreur pour une réservation rejetée', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({
        type: 'reservation_rejected',
        message: 'Cette date n’est plus disponible.',
      }),
    ]);
    const Banner = await loadBanner();

    render(<Banner />);

    expect(
      await screen.findByText('Réservation non disponible'),
    ).toBeInTheDocument();
    const banner = document.querySelector('.client-notif');
    expect(banner!.className).toContain('client-notif--error');
  });

  it('utilise la variante success pour une confirmation', async () => {
    mocks.getClientNotifications.mockResolvedValue([makeNotification()]);
    const Banner = await loadBanner();

    render(<Banner />);

    await screen.findByText('Réservation confirmée');
    const banner = document.querySelector('.client-notif');
    expect(banner!.className).toContain('client-notif--success');
  });

  it('enregistre le getter de jeton Clerk avant le chargement', async () => {
    mocks.getClientNotifications.mockResolvedValue([makeNotification()]);
    const Banner = await loadBanner();

    render(<Banner />);
    await screen.findByText('Réservation confirmée');

    expect(mocks.setAuthTokenGetter).toHaveBeenCalledTimes(1);
    const getter = mocks.setAuthTokenGetter.mock.calls[0]?.[0];
    if (!getter) throw new Error('setAuthTokenGetter appelé sans argument');
    await expect(getter()).resolves.toBe('session-token');
  });

  it('marque la notification comme lue au clic sur « Fermer » et la masque', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({ message: 'À fermer.' }),
    ]);
    const Banner = await loadBanner();

    render(<Banner />);
    await screen.findByText('À fermer.');

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(mocks.markClientNotificationAsRead).toHaveBeenCalledWith('notif-1');
    expect(screen.queryByText('À fermer.')).toBeNull();
    expect(document.querySelector('.client-notif')).toBeNull();
  });

  it('ferme localement même quand l’API de lecture échoue', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({ message: 'Résiliente.' }),
    ]);
    mocks.markClientNotificationAsRead.mockRejectedValue(
      new Error('Réseau indisponible'),
    );
    const Banner = await loadBanner();

    render(<Banner />);
    await screen.findByText('Résiliente.');

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(mocks.markClientNotificationAsRead).toHaveBeenCalledWith('notif-1');
    expect(screen.queryByText('Résiliente.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ne plante pas quand le premier chargement échoue', async () => {
    mocks.getClientNotifications.mockRejectedValue(new Error('boom'));
    const Banner = await loadBanner();

    const { container } = render(<Banner />);
    // Laisse l'effet rejeter : le composant avale l'erreur (polling de secours).
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.client-notif')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('recharge les notifications toutes les 30 secondes', async () => {
    mocks.getClientNotifications.mockResolvedValue([]);
    const Banner = await loadBanner();

    vi.useFakeTimers();
    render(<Banner />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.getClientNotifications).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(mocks.getClientNotifications).toHaveBeenCalledTimes(2);
  });
});
