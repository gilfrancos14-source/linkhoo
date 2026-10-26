import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BoiteReceptionMaq6 from './BoiteReceptionMaq6';
import type { Conversation, Message } from '../../lib/api';
import type { Room } from '../../data/rooms';

const mocks = vi.hoisted(() => ({
  gerantInbox: vi.fn<() => Promise<unknown>>(),
  listMessages: vi.fn<(id: string) => Promise<unknown>>(),
  sendMessage: vi.fn<(id: string, body: string) => Promise<unknown>>(),
  markRead: vi.fn<(id: string) => Promise<unknown>>(),
  fetchRoomById: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock('../../lib/api', () => ({
  apiMessages: {
    gerantInbox: mocks.gerantInbox,
    listMessages: mocks.listMessages,
    sendMessage: mocks.sendMessage,
    markRead: mocks.markRead,
  },
}));

vi.mock('../../data/rooms', () => ({
  fetchRoomById: mocks.fetchRoomById,
}));

vi.mock('../../hooks/useHomePath', () => ({
  useHomePath: () => '/ci',
}));

vi.mock('../../hooks/useGerantChrome', () => ({
  useGerantChrome: () => ({
    gerant: null,
    displayName: 'Gérant',
    initials: 'G',
    reservationsCount: 0,
    messagesUnread: 0,
  }),
}));

const conversation: Conversation = {
  id: 'conv-a',
  room_id: 'room-1',
  client_id: 'client-1',
  gerant_id: 'gerant-1',
  client_name: 'Jean Koffi',
  client_email: 'jean@test.com',
  last_message_at: '2026-02-01T10:05:00.000Z',
  created_at: '2026-02-01T09:00:00.000Z',
  room: { id: 'room-1', title: 'Suite vue mer', img: null, market: 'CI' },
  last_message: null,
  unread_count: 0,
};

const room = {
  id: 'room-1',
  title: 'Suite vue mer',
  subtitle: '',
  info: '',
  price: '75000',
  priceNum: 75000,
  priceUnit: '/ nuit',
  img: '',
  alt: '',
  images: [],
  description: '',
  category: 'ci-appartements',
  market: 'CI',
  pays: "Côte d'Ivoire",
  ville: 'Abidjan',
  quartier: 'Cocody',
  chambres: 2,
  douches: 1,
  disponible: true,
  dateDispo: '',
  conditions: '',
  isPopular: true,
} satisfies Room;

function message(overrides: Partial<Message>): Message {
  return {
    id: 'm1',
    conversation_id: 'conv-a',
    sender_role: 'client',
    body: 'Bonjour',
    read_at: null,
    created_at: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/gerant/messages/boite-reception']}>
      <BoiteReceptionMaq6 />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gerantInbox.mockResolvedValue({
    items: [conversation],
    total: 1,
    page: 1,
    limit: 30,
  });
  mocks.listMessages.mockResolvedValue([]);
  mocks.markRead.mockResolvedValue({ updated: 0 });
  mocks.sendMessage.mockImplementation(async (_id, body) =>
    message({ id: 'sent-1', body, sender_role: 'gerant' }),
  );
  mocks.fetchRoomById.mockResolvedValue(room);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BoiteReceptionMaq6', () => {
  it("affiche les messages dans l'ordre chronologique malgré l'API du plus récent au plus ancien", async () => {
    const older = message({
      id: 'm1',
      body: 'Bonjour',
      created_at: '2026-02-01T10:00:00.000Z',
      read_at: '2026-02-01T10:01:00.000Z',
    });
    const newer = message({
      id: 'm2',
      body: 'Toujours disponible ?',
      created_at: '2026-02-01T10:05:00.000Z',
      read_at: '2026-02-01T10:06:00.000Z',
    });
    mocks.listMessages.mockResolvedValue([newer, older]);

    renderPage();

    const first = await screen.findByText('Bonjour');
    const second = screen.getByText('Toujours disponible ?');
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('marque les messages reçus comme lus et remet le compteur à zéro', async () => {
    mocks.gerantInbox.mockResolvedValue({
      items: [{ ...conversation, unread_count: 1 }],
      total: 1,
      page: 1,
      limit: 30,
    });
    mocks.listMessages.mockResolvedValue([message({ id: 'm-unread' })]);

    renderPage();

    expect(await screen.findByText('Bonjour')).toBeInTheDocument();
    expect(mocks.markRead).toHaveBeenCalledWith('conv-a');
  });

  it('rafraîchit le fil ouvert toutes les 12 secondes', async () => {
    const older = message({ id: 'm1', body: 'Bonjour' });
    const newer = message({
      id: 'm2',
      body: 'Nouveau message',
      created_at: '2026-02-01T10:05:00.000Z',
    });
    mocks.listMessages.mockResolvedValueOnce([older]).mockResolvedValue([newer, older]);

    vi.useFakeTimers();
    renderPage();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Bonjour')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    expect(screen.getByText('Nouveau message')).toBeInTheDocument();
  });

  it('envoie un message et l’ajoute au fil', async () => {
    renderPage();

    const input = await screen.findByPlaceholderText('Écrivez votre message...');
    fireEvent.change(input, { target: { value: 'La chambre est libre.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(mocks.sendMessage).toHaveBeenCalledWith('conv-a', 'La chambre est libre.');
    expect(await screen.findByText('La chambre est libre.')).toBeInTheDocument();
  });

  it('affiche le statut de lecture réel des messages envoyés', async () => {
    mocks.listMessages.mockResolvedValue([
      message({
        id: 'm-read',
        sender_role: 'gerant',
        body: 'Message lu',
        read_at: '2026-02-01T10:02:00.000Z',
      }),
      message({
        id: 'm-sent',
        sender_role: 'gerant',
        body: 'Message envoyé',
        read_at: null,
        created_at: '2026-02-01T10:01:00.000Z',
      }),
    ]);

    renderPage();

    expect(await screen.findByLabelText('Lu')).toBeInTheDocument();
    expect(screen.getByLabelText('Envoyé')).toBeInTheDocument();
  });
});
