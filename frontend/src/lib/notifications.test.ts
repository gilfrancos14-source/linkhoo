import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addClientNotification,
  getNotifications,
  getClientNotifications,
  markAllAsRead,
  markAsRead,
  markClientNotificationAsRead,
} from './notifications';

const mocks = vi.hoisted(() => ({
  listAdmin: vi.fn<() => Promise<unknown[]>>(),
  listClient: vi.fn<() => Promise<unknown[]>>(),
  markRead: vi.fn<(id: string) => Promise<void>>(),
  markReadClient: vi.fn<(id: string) => Promise<void>>(),
  createClient: vi.fn<(data: unknown) => Promise<unknown>>(),
}));

vi.mock('../lib/api', () => ({
  apiNotifications: {
    listAdmin: mocks.listAdmin,
    listClient: mocks.listClient,
    markRead: mocks.markRead,
    markReadClient: mocks.markReadClient,
    createClient: mocks.createClient,
  },
}));

function rawAdminNotification(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'notif-1',
    type: 'reservation',
    room_title: 'Suite vue mer',
    room_id: 'room-1',
    client_name: 'Aya Koffi',
    client_email: 'aya@mail.ci',
    client_phone: '+225 01 02 03 04',
    message: 'Demande de réservation',
    reservation_id: 'res-1',
    read: false,
    date: '2030-06-01T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getNotifications', () => {
  it('transforme les champs snake_case de l’API', async () => {
    mocks.listAdmin.mockResolvedValue([rawAdminNotification()]);

    const [notification] = await getNotifications();

    expect(notification).toEqual({
      id: 'notif-1',
      type: 'reservation',
      roomTitle: 'Suite vue mer',
      roomId: 'room-1',
      clientName: 'Aya Koffi',
      clientEmail: 'aya@mail.ci',
      clientPhone: '+225 01 02 03 04',
      message: 'Demande de réservation',
      date: '2030-06-01T10:00:00Z',
      read: false,
      reservationId: 'res-1',
    });
  });

  it('conserve les valeurs nulles renvoyées par l’API', async () => {
    mocks.listAdmin.mockResolvedValue([
      rawAdminNotification({
        client_name: null,
        client_email: null,
        client_phone: null,
        reservation_id: null,
        read: true,
      }),
    ]);

    const [notification] = await getNotifications();

    expect(notification.clientName).toBeNull();
    expect(notification.reservationId).toBeNull();
    expect(notification.read).toBe(true);
  });

  it('renvoie un tableau vide sans notification', async () => {
    mocks.listAdmin.mockResolvedValue([]);

    await expect(getNotifications()).resolves.toEqual([]);
  });
});

describe('markAsRead', () => {
  it('délègue la lecture à apiNotifications.markRead', async () => {
    mocks.markRead.mockResolvedValue(undefined);

    await markAsRead('notif-7');

    expect(mocks.markRead).toHaveBeenCalledTimes(1);
    expect(mocks.markRead).toHaveBeenCalledWith('notif-7');
  });
});

describe('markAllAsRead', () => {
  it('ne marque que les notifications non lues', async () => {
    mocks.listAdmin.mockResolvedValue([
      rawAdminNotification({ id: 'notif-a', read: true }),
      rawAdminNotification({ id: 'notif-b', read: false }),
      rawAdminNotification({ id: 'notif-c', read: false }),
    ]);
    mocks.markRead.mockResolvedValue(undefined);

    await markAllAsRead();

    expect(mocks.markRead).toHaveBeenCalledTimes(2);
    expect(mocks.markRead).toHaveBeenNthCalledWith(1, 'notif-b');
    expect(mocks.markRead).toHaveBeenNthCalledWith(2, 'notif-c');
  });

  it('ne fait rien quand tout est déjà lu', async () => {
    mocks.listAdmin.mockResolvedValue([rawAdminNotification({ id: 'notif-a', read: true })]);
    mocks.markRead.mockResolvedValue(undefined);

    await markAllAsRead();

    expect(mocks.markRead).not.toHaveBeenCalled();
  });
});

describe('getClientNotifications', () => {
  it('transforme les notifications côté client', async () => {
    mocks.listClient.mockResolvedValue([
      {
        id: 'c-notif-1',
        type: 'reservation_confirmed',
        room_title: 'Chambre Jardin',
        room_id: 'room-3',
        client_email: 'client@mail.ci',
        message: 'Réservation confirmée',
        date: '2030-06-02T09:00:00Z',
        read: false,
      },
    ]);

    const [notification] = await getClientNotifications();

    expect(notification).toEqual({
      id: 'c-notif-1',
      type: 'reservation_confirmed',
      roomTitle: 'Chambre Jardin',
      roomId: 'room-3',
      clientEmail: 'client@mail.ci',
      message: 'Réservation confirmée',
      date: '2030-06-02T09:00:00Z',
      read: false,
    });
  });
});

describe('addClientNotification', () => {
  it('envoie uniquement les champs attendus par l’API', async () => {
    mocks.createClient.mockResolvedValue(undefined);

    await addClientNotification({
      type: 'reservation_rejected',
      roomTitle: 'Chambre Jardin',
      roomId: 'room-3',
      clientEmail: 'client@mail.ci',
      message: 'Réservation refusée',
    });

    expect(mocks.createClient).toHaveBeenCalledWith({
      type: 'reservation_rejected',
      roomTitle: 'Chambre Jardin',
      roomId: 'room-3',
      clientEmail: 'client@mail.ci',
      message: 'Réservation refusée',
    });
  });
});

describe('markClientNotificationAsRead', () => {
  it('délègue à markReadClient', async () => {
    mocks.markReadClient.mockResolvedValue(undefined);

    await markClientNotificationAsRead('c-notif-2');

    expect(mocks.markReadClient).toHaveBeenCalledWith('c-notif-2');
  });
});
