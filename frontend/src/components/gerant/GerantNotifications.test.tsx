import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Notification } from '../../lib/notifications';
import GerantNotifications from './GerantNotifications';

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn<() => Promise<Notification[]>>(),
  markAsRead: vi.fn<(id: string) => Promise<void>>(),
  markAllAsRead: vi.fn<() => Promise<void>>(),
  addClientNotification: vi.fn<(data: Record<string, unknown>) => Promise<void>>(),
  getReservations: vi.fn<() => Promise<unknown[]>>(),
  checkDateConflict: vi.fn<() => Promise<{ hasConflict: boolean }>>(),
  updateReservationStatut: vi.fn<(id: string, statut: string) => Promise<void>>(),
}));

vi.mock('../../lib/notifications', () => ({
  getNotifications: mocks.getNotifications,
  markAsRead: mocks.markAsRead,
  markAllAsRead: mocks.markAllAsRead,
  addClientNotification: mocks.addClientNotification,
}));

vi.mock('../../lib/reservations', () => ({
  getReservations: mocks.getReservations,
  checkDateConflict: mocks.checkDateConflict,
  updateReservationStatut: mocks.updateReservationStatut,
}));

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'payout_paid',
    roomTitle: '',
    roomId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    message: 'Reversement de 225 000 XOF envoyé.',
    date: new Date().toISOString(),
    read: true,
    ...overrides,
  };
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/ci/gerant']}>
      <GerantNotifications isQualified />
      <LocationProbe />
      <Routes>
        <Route path="/ci/gerant/reversements" element={<div>Page reversements</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNotifications.mockResolvedValue([]);
  mocks.markAsRead.mockResolvedValue(undefined);
  mocks.markAllAsRead.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GerantNotifications — lot 1', () => {
  it('affiche le message envoyé par le backend pour un type payout', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Reversement de 225 000 XOF envoyé.')).toBeInTheDocument();
    expect(screen.getByText('Reversement versé')).toBeInTheDocument();
  });

  it('ouvre la page du marché depuis l’action « Voir »', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif({ type: 'payout_retry_started' })]);

    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Voir' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/ci/gerant/reversements'));
    expect(mocks.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('affiche un toast quand une nouvelle notification apparaît au rechargement', async () => {
    const initial = makeNotif({ id: 'n1', message: 'Ancienne notification', read: false });
    const fresh = makeNotif({
      id: 'n2',
      type: 'message_received',
      message: 'Nouveau message de Jean : « Bonjour »',
      read: false,
    });
    mocks.getNotifications.mockResolvedValueOnce([initial]).mockResolvedValue([initial, fresh]);

    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tout marquer lu' }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Nouveau message de Jean');
    expect(toast).toHaveTextContent('Messagerie');
  });
});
