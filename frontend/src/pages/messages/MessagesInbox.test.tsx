import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MessagesInbox from './MessagesInbox';
import type { Conversation } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  inbox: vi.fn<() => Promise<unknown>>(),
  gerantInbox: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../../lib/api', () => ({
  apiMessages: { inbox: mocks.inbox, gerantInbox: mocks.gerantInbox },
}));

const CONV: Conversation = {
  id: 'conv-1',
  room_id: 'r1',
  client_id: 'user_client',
  gerant_id: 'user_gerant',
  client_name: 'Jean Koffi',
  client_email: 'jean@test.com',
  last_message_at: new Date(Date.now() - 120_000).toISOString(),
  created_at: '2026-01-01T00:00:00Z',
  room: { id: 'r1', title: 'Suite vue mer', img: '/images/suite.jpg', market: 'CI' },
  last_message: {
    id: 'm1',
    conversation_id: 'conv-1',
    sender_role: 'client',
    body: 'Bonjour, la chambre est-elle libre ?',
    read_at: null,
    created_at: new Date(Date.now() - 120_000).toISOString(),
  },
  unread_count: 2,
};

function renderInbox(side: 'client' | 'gerant' = 'client') {
  return render(
    <MemoryRouter initialEntries={[side === 'client' ? '/ci/messages' : '/ci/gerant/messages']}>
      <Routes>
        <Route
          path="/ci/messages"
          element={<MessagesInbox side="client" basePath="/ci/messages" />}
        />
        <Route
          path="/ci/gerant/messages"
          element={<MessagesInbox side="gerant" basePath="/ci/gerant/messages" />}
        />
        <Route
          path="/ci/messages/:conversationId"
          element={<div data-testid="thread">Fil</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('MessagesInbox', () => {
  it("affiche les conversations du client avec le titre de la chambre et le badge de non-lus", async () => {
    mocks.inbox.mockResolvedValue({ items: [CONV], total: 1, page: 1, limit: 30 });

    renderInbox('client');

    expect(await screen.findByText('Suite vue mer')).toBeInTheDocument();
    expect(
      screen.getByText('Vous : Bonjour, la chambre est-elle libre ?'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('2 non lus')).toBeInTheDocument();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
    expect(mocks.gerantInbox).not.toHaveBeenCalled();
  });

  it("côté gérant, affiche le nom du client et le titre de la chambre en aperçu", async () => {
    mocks.gerantInbox.mockResolvedValue({ items: [CONV], total: 1, page: 1, limit: 30 });

    renderInbox('gerant');

    expect(await screen.findByText('Jean Koffi')).toBeInTheDocument();
    expect(screen.getByText(/Suite vue mer/)).toBeInTheDocument();
    expect(mocks.gerantInbox).toHaveBeenCalledTimes(1);
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  it("affiche l'état vide côté client", async () => {
    mocks.inbox.mockResolvedValue({ items: [], total: 0, page: 1, limit: 30 });

    renderInbox('client');

    expect(
      await screen.findByText(/Aucune conversation pour le moment/),
    ).toBeInTheDocument();
  });

  it("affiche un message d'erreur quand le chargement échoue", async () => {
    mocks.inbox.mockRejectedValue(new Error('boom'));

    renderInbox('client');

    expect(
      await screen.findByText('Impossible de charger vos conversations.'),
    ).toBeInTheDocument();
  });

  it("chaque ligne pointe vers le fil de la conversation", async () => {
    mocks.inbox.mockResolvedValue({ items: [CONV], total: 1, page: 1, limit: 30 });

    renderInbox('client');

    const row = await screen.findByRole('link');
    expect(row).toHaveAttribute('href', '/ci/messages/conv-1');
  });

  it("préfixe « Vous : » sur son propre dernier message", async () => {
    mocks.gerantInbox.mockResolvedValue({
      items: [{ ...CONV, last_message: { ...CONV.last_message, sender_role: 'gerant' } }],
      total: 1,
      page: 1,
      limit: 30,
    });

    renderInbox('gerant');

    expect(await screen.findByText('Vous : Bonjour, la chambre est-elle libre ?')).toBeInTheDocument();
  });
});
