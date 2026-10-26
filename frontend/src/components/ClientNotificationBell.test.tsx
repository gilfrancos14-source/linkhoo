import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientNotification } from '../lib/notifications';
import ClientNotificationBell from './ClientNotificationBell';

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
    date: new Date().toISOString(),
    read: false,
    ...overrides,
  };
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
});

describe('ClientNotificationBell', () => {
  it("n'affiche rien pour un visiteur non connecté", () => {
    mocks.isSignedIn = false;

    const { container } = render(<ClientNotificationBell />);

    expect(container.firstChild).toBeNull();
    expect(mocks.getClientNotifications).not.toHaveBeenCalled();
  });

  it('affiche le compteur non lu et la liste au clic', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification(),
      makeNotification({ id: 'notif-lue', read: true, message: 'Déjà lue.' }),
    ]);
    render(<ClientNotificationBell />);

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell).toHaveTextContent('1');

    await userEvent.click(bell);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Votre réservation est confirmée.')).toBeInTheDocument();
    expect(screen.getByText('Déjà lue.')).toBeInTheDocument();
  });

  it("affiche l'état vide sans notification", async () => {
    render(<ClientNotificationBell />);

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell).not.toHaveTextContent(/\d/);

    await userEvent.click(bell);

    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
  });

  it('marque une notification comme lue au clic', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({ message: 'À marquer lue.' }),
    ]);
    render(<ClientNotificationBell />);

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    await userEvent.click(bell);
    await userEvent.click(screen.getByText('À marquer lue.'));

    expect(mocks.markClientNotificationAsRead).toHaveBeenCalledWith('notif-1');
    expect(bell).not.toHaveTextContent('1');
    expect(screen.getByText('À marquer lue.').closest('.notif-item')).not.toHaveClass(
      'notif-item--unread',
    );
  });

  it('marque toutes les notifications non lues en un geste', async () => {
    mocks.getClientNotifications.mockResolvedValue([
      makeNotification({ id: 'n-1' }),
      makeNotification({ id: 'n-2' }),
      makeNotification({ id: 'n-3', read: true }),
    ]);
    render(<ClientNotificationBell />);

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    await userEvent.click(bell);
    await userEvent.click(screen.getByRole('button', { name: 'Tout marquer lu' }));

    expect(mocks.markClientNotificationAsRead).toHaveBeenCalledTimes(2);
    expect(mocks.markClientNotificationAsRead).toHaveBeenCalledWith('n-1');
    expect(mocks.markClientNotificationAsRead).toHaveBeenCalledWith('n-2');
    expect(bell).not.toHaveTextContent('2');
  });

  it('recharge les notifications toutes les 30 secondes', async () => {
    vi.useFakeTimers();
    render(<ClientNotificationBell />);
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
