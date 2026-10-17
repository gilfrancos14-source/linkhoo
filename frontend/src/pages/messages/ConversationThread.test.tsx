import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConversationThread from './ConversationThread';
import type { Conversation, Message } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  getConversation: vi.fn<(id: string) => Promise<unknown>>(),
  listMessages: vi.fn<(id: string, page: number) => Promise<unknown>>(),
  sendMessage: vi.fn<(id: string, body: string) => Promise<unknown>>(),
  markRead: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock('../../lib/api', () => ({
  apiMessages: {
    getConversation: mocks.getConversation,
    listMessages: mocks.listMessages,
    sendMessage: mocks.sendMessage,
    markRead: mocks.markRead,
  },
}));

const CONVERSATION: Conversation = {
  id: 'conv-1',
  room_id: 'r1',
  client_id: 'user_client',
  gerant_id: 'user_gerant',
  client_name: 'Jean Koffi',
  client_email: 'jean@test.com',
  last_message_at: '2026-02-01T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  room: { id: 'r1', title: 'Suite vue mer', img: '/images/suite.jpg', market: 'CI' },
};

function msg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    conversation_id: 'conv-1',
    sender_role: 'client',
    body: 'Bonjour',
    read_at: null,
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

function renderThread(role: 'client' | 'gerant' = 'client') {
  const basePath = role === 'client' ? '/ci/messages' : '/ci/gerant/messages';
  return render(
    <MemoryRouter initialEntries={[`${basePath}/conv-1`]}>
      <Routes>
        <Route
          path={`${basePath}/:conversationId`}
          element={
            <ConversationThread conversationId="conv-1" role={role} basePath={basePath} />
          }
        />
        <Route path={basePath} element={<div data-testid="inbox">Boîte</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConversation.mockResolvedValue(CONVERSATION);
  mocks.listMessages.mockResolvedValue([]);
  mocks.markRead.mockResolvedValue({ updated: 0 });
});

afterEach(cleanup);

describe('ConversationThread', () => {
  it("affiche les messages reçus et envoyés avec le titre de la chambre", async () => {
    mocks.listMessages.mockResolvedValue([
      msg({ id: 'm1', body: 'Bonjour', sender_role: 'client', created_at: '2026-02-01T10:00:00Z' }),
      msg({ id: 'm2', body: 'Bienvenue !', sender_role: 'gerant', created_at: '2026-02-01T10:01:00Z', read_at: '2026-02-01T10:02:00Z' }),
    ]);

    renderThread('client');

    expect(await screen.findByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText('Bienvenue !')).toBeInTheDocument();
    expect(screen.getByText('« Suite vue mer »')).toBeInTheDocument();
    expect(document.querySelector('.msg-bubble--mine')).not.toBeNull();
  });

  it("marque les messages reçus non lus comme lus au chargement", async () => {
    const unread = [msg({ id: 'm2', body: 'Re ?', sender_role: 'gerant', read_at: null })];
    mocks.listMessages
      .mockResolvedValueOnce(unread)
      .mockResolvedValueOnce([
        msg({ id: 'm2', body: 'Re ?', sender_role: 'gerant', read_at: '2026-02-01T11:00:00Z' }),
      ]);

    renderThread('client');

    expect(await screen.findByText('Re ?')).toBeInTheDocument();
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith('conv-1'));
  });

  it("n'appelle pas markRead quand tous les messages sont déjà lus", async () => {
    mocks.listMessages.mockResolvedValue([
      msg({ id: 'm1', body: 'Bonjour', sender_role: 'client' }),
      msg({ id: 'm2', body: 'Salut', sender_role: 'gerant', read_at: '2026-02-01T10:00:00Z' }),
    ]);

    renderThread('client');

    expect(await screen.findByText('Salut')).toBeInTheDocument();
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("envoie un message via le composer et l'affiche", async () => {
    mocks.sendMessage.mockResolvedValue(
      msg({ id: 'm3', body: 'La chambre est libre vendredi', sender_role: 'client' }),
    );

    renderThread('client');

    fireEvent.change(await screen.findByLabelText('Votre message'), {
      target: { value: 'La chambre est libre vendredi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('La chambre est libre vendredi')).toBeInTheDocument();
    expect(mocks.sendMessage).toHaveBeenCalledWith('conv-1', 'La chambre est libre vendredi');
  });

  it("laisse le bouton Envoyer inactif sans texte", async () => {
    renderThread('client');

    expect(await screen.findByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  it("affiche une erreur quand l'envoi échoue", async () => {
    mocks.sendMessage.mockRejectedValue(new Error('boom'));

    renderThread('client');

    fireEvent.change(await screen.findByLabelText('Votre message'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(
      await screen.findByText('Envoi impossible, veuillez réessayer.'),
    ).toBeInTheDocument();
  });

  it("propose de charger les messages plus anciens quand la page 1 est pleine", async () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      msg({ id: `m${i}`, body: `Message ${i}`, created_at: `2026-02-01T10:00:${String(i).padStart(2, '0')}Z` }),
    );
    mocks.listMessages
      .mockResolvedValueOnce(many)
      .mockResolvedValueOnce([msg({ id: 'm-old', body: 'Très ancien', created_at: '2026-01-01T00:00:00Z' })]);

    renderThread('client');

    fireEvent.click(await screen.findByRole('button', { name: /plus anciens/ }));

    expect(await screen.findByText('Très ancien')).toBeInTheDocument();
    expect(mocks.listMessages).toHaveBeenNthCalledWith(2, 'conv-1', 2);
  });

  it("affiche « Conversation introuvable » quand le chargement échoue", async () => {
    mocks.getConversation.mockRejectedValue(new Error('404'));
    mocks.listMessages.mockRejectedValue(new Error('404'));

    renderThread('client');

    expect(await screen.findByText('Conversation introuvable')).toBeInTheDocument();
  });

  it("retrouve la boîte de réception via le lien de retour", async () => {
    renderThread('client');

    fireEvent.click(await screen.findByRole('link', { name: 'Retour aux messages' }));
    expect(await screen.findByTestId('inbox')).toBeInTheDocument();
  });

  it("côté gérant, affiche le nom du client et le titre de la chambre", async () => {
    renderThread('gerant');

    expect(await screen.findByText('Jean Koffi')).toBeInTheDocument();
    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
  });
});
